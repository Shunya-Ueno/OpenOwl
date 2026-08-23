import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../shared/supabase/client';
import { queryKeys } from '../../../shared/query/queryKeys';
import { WordInput } from '../domain/WordInput';
import type { SynonymResult, PartOfSpeech, Register } from '../domain/SynonymResult';

/**
 * URL 直接アクセス・リロード・履歴タップの入口用。生成はせず、自分の直近の
 * lookup を読むだけ(ADR-0012)。`user_id` の条件を書かないのは RLS が自動で
 * 絞るため(docs/api-spec.md 4.1)。
 */
export function useStoredSynonyms(rawWord: string) {
  return useQuery({
    queryKey: queryKeys.storedSynonyms(rawWord),
    queryFn: (): Promise<SynonymResult | null> => fetchStoredSynonyms(rawWord),
    enabled: rawWord.length > 0,
  });
}

async function fetchStoredSynonyms(rawWord: string): Promise<SynonymResult | null> {
  const wordInput = WordInput.parse(rawWord);

  const { data, error } = await supabase
    .from('lookups')
    .select(
      `
        terms!lookups_term_id_fkey ( id, display_text, language ),
        synonym_generations!lookups_generation_id_fkey (
          id,
          model,
          created_at,
          synonym_items!synonym_items_generation_id_fkey (
            position, synonym_text, part_of_speech, register, nuance
          )
        )
      `,
    )
    .eq('terms.normalized_text', wordInput.normalizedText)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.terms || !data.synonym_generations) {
    // lookups.generation_id は ON DELETE SET NULL のため null になりうる。
    // その場合は「保存されていない結果」として扱う(docs/frontend-design.md 5.4)。
    return null;
  }

  const generation = data.synonym_generations;
  const items = [...generation.synonym_items].sort((a, b) => a.position - b.position);

  return {
    term: {
      id: data.terms.id,
      text: data.terms.display_text,
      language: data.terms.language,
    },
    generation: {
      id: generation.id,
      model: generation.model,
      createdAt: generation.created_at,
      cached: true,
      stale: false,
    },
    synonyms: items.map((item) => ({
      text: item.synonym_text,
      partOfSpeech: item.part_of_speech as PartOfSpeech | null,
      register: item.register as Register | null,
      nuance: item.nuance,
    })),
  };
}
