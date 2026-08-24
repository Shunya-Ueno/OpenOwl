import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type {
  SaveGenerationInput,
  SynonymGenerationRepository,
} from '../../domain/ports/SynonymGenerationRepository.ts';
import type { ResolvedTerm } from '../../domain/ports/TermRepository.ts';
import { SynonymGeneration } from '../../domain/SynonymGeneration.ts';
import { Synonym } from '../../domain/Synonym.ts';
import { InternalDomainError } from '../../domain/errors.ts';

type SynonymItemRow = Database['public']['Tables']['synonym_items']['Row'];

/** service_role クライアントで RPC を呼ぶ。書き込みは RPC 経由のみ(直接 insert しない)。 */
export class SupabaseSynonymGenerationRepository implements SynonymGenerationRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findLatest(
    term: ResolvedTerm,
    model: string,
    promptVersion: string,
  ): Promise<SynonymGeneration | null> {
    const { data, error } = await this.client.rpc('find_latest_generation', {
      p_term_id: term.id,
      p_model: model,
      p_prompt_version: promptVersion,
    });

    if (error) {
      throw new InternalDomainError(`failed to look up latest generation: ${error.message}`, error);
    }
    const row = data?.[0];
    if (!row) return null;

    const items = await this.loadItems(row.id);

    return new SynonymGeneration(
      row.id,
      items,
      model,
      promptVersion,
      new Date(row.created_at),
      { promptTokens: null, completionTokens: null, cachedPromptTokens: null },
    );
  }

  async saveWithLookup(userId: string, input: SaveGenerationInput): Promise<SynonymGeneration> {
    const { data: generationId, error } = await this.client.rpc('save_synonym_generation', {
      p_term_id: input.term.id,
      p_user_id: userId,
      p_model: input.model,
      p_prompt_version: input.promptVersion,
      p_max_results: input.maxResults,
      // RPC の引数は DEFAULT NULL を持つため型上は `number | undefined`(生成された
      // database.types.ts を参照)。null をそのまま渡すと型エラーになるため、
      // undefined に変換して「省略」として扱う(DB 側は結局 NULL になり挙動は同じ)。
      p_prompt_tokens: input.promptTokens ?? undefined,
      p_completion_tokens: input.completionTokens ?? undefined,
      p_cached_prompt_tokens: input.cachedPromptTokens ?? undefined,
      p_latency_ms: input.latencyMs,
      p_items: input.synonyms.map((s, index) => ({
        position: index,
        synonym_text: s.text,
        part_of_speech: s.partOfSpeech,
        register: s.register,
        nuance: s.nuance,
      })),
    });

    if (error || !generationId) {
      throw new InternalDomainError(
        `failed to save generation: ${error?.message ?? 'no id returned'}`,
        error,
      );
    }

    return new SynonymGeneration(
      generationId,
      input.synonyms,
      input.model,
      input.promptVersion,
      new Date(),
      {
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        cachedPromptTokens: input.cachedPromptTokens,
      },
    );
  }

  private async loadItems(generationId: string): Promise<Synonym[]> {
    const { data, error } = await this.client
      .from('synonym_items')
      .select('synonym_text, part_of_speech, register, nuance')
      .eq('generation_id', generationId)
      .order('position', { ascending: true });

    if (error) {
      throw new InternalDomainError(`failed to load synonym items: ${error.message}`, error);
    }

    return (data as Pick<
      SynonymItemRow,
      'synonym_text' | 'part_of_speech' | 'register' | 'nuance'
    >[]).map(
      (row) =>
        new Synonym(
          row.synonym_text,
          row.part_of_speech as Synonym['partOfSpeech'],
          row.register as Synonym['register'],
          row.nuance,
        ),
    );
  }
}
