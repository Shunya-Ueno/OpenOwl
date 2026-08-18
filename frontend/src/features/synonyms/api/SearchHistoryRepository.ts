import { z } from 'zod';
import { supabase } from '@/shared/api/supabaseClient';
import { InternalAppError } from '@/shared/api/InternalAppError';
import { Synonym, type PartOfSpeech } from '../domain/Synonym';
import { SearchHistoryEntry } from '../domain/SearchHistoryEntry';

const PART_OF_SPEECH_VALUES = ['noun', 'verb', 'adjective', 'adverb', 'other'] as const;
const PAGE_SIZE = 20;

const synonymRowSchema = z.object({
  id: z.string(),
  sort_order: z.number(),
  term: z.string(),
  part_of_speech: z.enum(PART_OF_SPEECH_VALUES).nullable(),
  definition: z.string().nullable(),
  nuance: z.string().nullable(),
});

const historyRowSchema = z.object({
  id: z.string(),
  raw_input: z.string(),
  outcome: z.enum(['generated', 'cache']),
  created_at: z.string(),
  words: z.object({ id: z.string(), text: z.string(), language: z.string() }),
  synonym_generations: z
    .object({
      id: z.string(),
      created_at: z.string(),
      synonyms: z.array(synonymRowSchema),
    })
    .nullable(),
});

const SELECT_COLUMNS = `
  id,
  raw_input,
  outcome,
  created_at,
  words ( id, text, language ),
  synonym_generations (
    id,
    created_at,
    synonyms ( id, sort_order, term, part_of_speech, definition, nuance )
  )
`;

/**
 * 検索履歴の読み取り。RLS で保護されるためユーザー ID での絞り込みはクエリに書かない
 * (自分の行だけが自動的に返る。docs/api-spec.md の「読み取り系」)。
 * Edge Function を作らず、直接 PostgREST に問い合わせる方針(docs/adr/0004)。
 */
export class SearchHistoryRepository {
  async list(page = 0): Promise<SearchHistoryEntry[]> {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('search_history')
      .select(SELECT_COLUMNS)
      .neq('outcome', 'failed')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new InternalAppError(`検索履歴の取得に失敗しました: ${error.message}`, error);
    }

    return data.map((row) => this.toEntry(row));
  }

  async getById(id: string): Promise<SearchHistoryEntry | null> {
    const { data, error } = await supabase
      .from('search_history')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalAppError(`検索履歴の取得に失敗しました: ${error.message}`, error);
    }
    if (!data) return null;

    return this.toEntry(data);
  }

  private toEntry(row: unknown): SearchHistoryEntry {
    const parsed = historyRowSchema.parse(row);
    return new SearchHistoryEntry(
      parsed.id,
      parsed.raw_input,
      parsed.outcome,
      new Date(parsed.created_at),
      parsed.words,
      parsed.synonym_generations
        ? {
            id: parsed.synonym_generations.id,
            createdAt: new Date(parsed.synonym_generations.created_at),
            synonyms: parsed.synonym_generations.synonyms.map(
              (s) =>
                new Synonym(
                  s.id,
                  s.sort_order,
                  s.term,
                  s.part_of_speech as PartOfSpeech | null,
                  s.definition ?? '',
                  s.nuance ?? '',
                ),
            ),
          }
        : null,
    );
  }
}

export const searchHistoryRepository = new SearchHistoryRepository();
