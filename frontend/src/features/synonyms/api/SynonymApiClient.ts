import { z } from 'zod';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/shared/api/supabaseClient';
import { ApiError } from '@/shared/api/ApiError';
import { Synonym, type PartOfSpeech } from '../domain/Synonym';
import { SynonymGeneration } from '../domain/SynonymGeneration';

const PART_OF_SPEECH_VALUES = ['noun', 'verb', 'adjective', 'adverb', 'other'] as const;

// Edge Function のレスポンスは外部入力として unknown で受け、実行時に検証する
// (docs/api-spec.md の契約を単一の正としつつ、ドリフトに対して防御的にする)。
const responseSchema = z.object({
  requestId: z.string(),
  word: z.object({ id: z.string(), text: z.string(), language: z.string() }),
  source: z.enum(['generated', 'cache']),
  generationId: z.string(),
  generatedAt: z.string(),
  synonyms: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number(),
      term: z.string(),
      partOfSpeech: z.enum(PART_OF_SPEECH_VALUES).nullable(),
      definition: z.string(),
      nuance: z.string(),
    }),
  ),
  usage: z.object({ dailyLimit: z.number(), remainingToday: z.number() }),
});

/**
 * `generate-synonyms` Edge Function のクライアント。
 * feature 内で Supabase Functions への唯一の接点とする。
 */
export class SynonymApiClient {
  async generate(word: string): Promise<SynonymGeneration> {
    const { data, error } = await supabase.functions.invoke('generate-synonyms', {
      body: { word, language: 'en' },
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        throw ApiError.fromResponseBody(body);
      }
      throw ApiError.fromNetworkFailure(error);
    }

    return this.toSynonymGeneration(data);
  }

  private toSynonymGeneration(data: unknown): SynonymGeneration {
    const parsed = responseSchema.parse(data);
    return new SynonymGeneration(
      parsed.requestId,
      parsed.word,
      parsed.source,
      parsed.generationId,
      new Date(parsed.generatedAt),
      parsed.synonyms.map(
        (s) =>
          new Synonym(
            s.id,
            s.sortOrder,
            s.term,
            s.partOfSpeech as PartOfSpeech | null,
            s.definition,
            s.nuance,
          ),
      ),
      parsed.usage,
    );
  }
}

export const synonymApiClient = new SynonymApiClient();
