import { z } from 'zod';
import type { WordText } from '../../domain/model/WordText.ts';
import { Synonym, type PartOfSpeech } from '../../domain/model/Synonym.ts';
import {
  LlmInvalidResponseError,
  LlmOutputTruncatedError,
  NotAKnownWordError,
} from '../../domain/error/AppError.ts';
import type { GeminiRawResponse } from './GeminiHttpClient.ts';

const SYSTEM_INSTRUCTION = [
  'You are an English thesaurus for Japanese learners.',
  'Return exactly 5 common synonyms of the given English word.',
  'Write "definition" and "nuance" in Japanese, each within 40 characters.',
  '"nuance" must explain how it differs from the input word.',
  'If the input is not an English word, set isKnownWord to false and return an empty array.',
].join(' ');

const PART_OF_SPEECH_VALUES = ['noun', 'verb', 'adjective', 'adverb', 'other'] as const;

const responseSchema = z.object({
  isKnownWord: z.boolean(),
  synonyms: z
    .array(
      z.object({
        term: z.string().min(1).max(64),
        partOfSpeech: z.enum(PART_OF_SPEECH_VALUES),
        definition: z.string().min(1).max(200),
        nuance: z.string().min(1).max(200),
      }),
    )
    .max(20),
});

const geminiEnvelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        // MAX_TOKENS で打ち切られた場合、content ごと欠落することがある。
        // ここを必須にすると finishReason を見る前にスキーマ検証で落ち、
        // 切り詰めを切り詰めとして検知できなくなるため optional にする。
        content: z
          .object({
            parts: z.array(z.object({ text: z.string() })).min(1),
          })
          .optional(),
      }),
    )
    .min(1),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});

export interface ParsedGeminiResponse {
  readonly synonyms: readonly Synonym[];
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
}

/**
 * プロンプト本文・応答スキーマ・応答の検証を担当する。
 * VERSION を上げると synonym_generations.prompt_version が変わり、キャッシュが自動的に無効化される。
 */
export class SynonymPrompt {
  static readonly VERSION = 'v1';

  buildRequest(word: WordText): unknown {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: word.value }] }],
      generationConfig: {
        temperature: 0.3,
        // 5件 ×(term + 品詞 + 日本語40字×2)。日本語は1文字あたり1〜2トークンかかるため
        // 1件あたり最大 ~150 トークン、JSON の構造分を加えて ~900 が最悪ケース。
        // 800 では切り詰めが起きうるため余裕を持たせる(暴走出力の上限としては機能する)。
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            isKnownWord: { type: 'boolean' },
            synonyms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  term: { type: 'string' },
                  partOfSpeech: { type: 'string', enum: PART_OF_SPEECH_VALUES },
                  definition: { type: 'string' },
                  nuance: { type: 'string' },
                },
                required: ['term', 'partOfSpeech', 'definition', 'nuance'],
                propertyOrdering: ['term', 'partOfSpeech', 'definition', 'nuance'],
              },
            },
          },
          required: ['isKnownWord', 'synonyms'],
        },
        // Gemini 3 系では thinkingBudget: 0 が 400 INVALID_ARGUMENT で拒否される
        // (thinking を完全に無効化できない世代)。1 を指定すれば実測で
        // thoughtsTokenCount は 0 のままなので、コストは 0 指定時と変わらない。
        thinkingConfig: { thinkingBudget: 1 },
      },
    };
  }

  parse(raw: GeminiRawResponse): ParsedGeminiResponse {
    const envelope = geminiEnvelopeSchema.safeParse(raw.body);
    if (!envelope.success) {
      throw new LlmInvalidResponseError(
        'gemini response envelope did not match expected shape',
        { promptTokens: null, completionTokens: null, latencyMs: raw.latencyMs },
        envelope.error,
      );
    }

    const promptTokens = envelope.data.usageMetadata?.promptTokenCount ?? null;
    const completionTokens = envelope.data.usageMetadata?.candidatesTokenCount ?? null;
    const telemetry = { promptTokens, completionTokens, latencyMs: raw.latencyMs };

    const candidate = envelope.data.candidates[0];

    // finishReason を検査する。MAX_TOKENS で切れた JSON は「スキーマ不適合」として
    // 扱うと原因が分からず、しかも retryable 扱いで無駄な再課金を招く。
    // 切り詰めは同じ入力なら決定的に再発するため、専用の非リトライエラーにする。
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      const message = `gemini stopped early: finishReason=${candidate.finishReason}`;
      if (candidate.finishReason === 'MAX_TOKENS') {
        throw new LlmOutputTruncatedError(message, telemetry);
      }
      throw new LlmInvalidResponseError(message, telemetry);
    }

    if (!candidate.content) {
      throw new LlmInvalidResponseError(
        'gemini response candidate contained no content',
        telemetry,
      );
    }

    const text = candidate.content.parts[0].text;

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new LlmInvalidResponseError('gemini response body was not valid JSON', telemetry, error);
    }

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LlmInvalidResponseError(
        'gemini response did not match expected schema',
        telemetry,
        parsed.error,
      );
    }

    if (!parsed.data.isKnownWord || parsed.data.synonyms.length === 0) {
      throw new NotAKnownWordError('gemini reported the input is not a known word', telemetry);
    }

    const synonyms = parsed.data.synonyms.map(
      (item, index) =>
        new Synonym(
          item.term,
          item.partOfSpeech as PartOfSpeech,
          item.definition,
          item.nuance,
          index + 1,
        ),
    );

    return { synonyms, promptTokens, completionTokens };
  }
}
