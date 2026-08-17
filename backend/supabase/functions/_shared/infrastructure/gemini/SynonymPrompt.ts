import { z } from 'zod';
import type { WordText } from '../../domain/model/WordText.ts';
import { Synonym, type PartOfSpeech } from '../../domain/model/Synonym.ts';
import { LlmInvalidResponseError, NotAKnownWordError } from '../../domain/error/AppError.ts';
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
        content: z.object({
          parts: z.array(z.object({ text: z.string() })).min(1),
        }),
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
        maxOutputTokens: 800,
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
        thinkingConfig: { thinkingBudget: 0 },
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

    const text = envelope.data.candidates[0].content.parts[0].text;

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
