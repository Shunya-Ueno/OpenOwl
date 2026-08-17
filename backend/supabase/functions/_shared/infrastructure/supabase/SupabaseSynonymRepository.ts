import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type {
  SynonymRepository,
  SaveGenerationInput,
  RecordFailureInput,
} from '../../domain/port/SynonymRepository.ts';
import { Word } from '../../domain/model/Word.ts';
import { Synonym, type PartOfSpeech } from '../../domain/model/Synonym.ts';
import { SynonymGeneration } from '../../domain/model/SynonymGeneration.ts';
import type { WordText } from '../../domain/model/WordText.ts';
import { InternalError } from '../../domain/error/AppError.ts';

/** UNIQUE 制約違反(同時挿入によるレース)を示す Postgres のエラーコード。 */
const UNIQUE_VIOLATION = '23505';

/**
 * SynonymRepository の Supabase(Postgres)実装。
 * この Function には service_role で作られたクライアントを渡し、RLS を経由せず書き込む。
 */
export class SupabaseSynonymRepository implements SynonymRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findOrCreateWord(text: WordText, language: string): Promise<Word> {
    const existing = await this.client
      .from('words')
      .select('id, text, language')
      .eq('language', language)
      .eq('text', text.value)
      .maybeSingle();

    if (existing.error) {
      throw new InternalError(`failed to look up word: ${existing.error.message}`, existing.error);
    }
    if (existing.data) {
      return new Word(existing.data.id, existing.data.text, existing.data.language);
    }

    const inserted = await this.client
      .from('words')
      .insert({ text: text.value, language })
      .select('id, text, language')
      .single();

    if (inserted.error) {
      // 同時に同じ単語が初検索された場合のレースは正常系として再取得する。
      if (inserted.error.code === UNIQUE_VIOLATION) {
        return this.findOrCreateWord(text, language);
      }
      throw new InternalError(`failed to create word: ${inserted.error.message}`, inserted.error);
    }

    return new Word(inserted.data.id, inserted.data.text, inserted.data.language);
  }

  async findLatestGeneration(
    word: Word,
    model: string,
    promptVersion: string,
  ): Promise<SynonymGeneration | null> {
    const generation = await this.client
      .from('synonym_generations')
      .select('id, created_at')
      .eq('word_id', word.id)
      .eq('model', model)
      .eq('prompt_version', promptVersion)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (generation.error) {
      throw new InternalError(
        `failed to look up cached generation: ${generation.error.message}`,
        generation.error,
      );
    }
    if (!generation.data) return null;

    const synonyms = await this.loadSynonyms(generation.data.id);

    return new SynonymGeneration(
      generation.data.id,
      word,
      synonyms,
      model,
      promptVersion,
      new Date(generation.data.created_at),
    );
  }

  async saveGeneration(input: SaveGenerationInput): Promise<SynonymGeneration> {
    const { data, error } = await this.client.rpc('record_synonym_generation', {
      p_user_id: input.userId,
      p_word_id: input.word.id,
      p_raw_input: input.rawInput,
      p_model: input.model,
      p_prompt_version: input.promptVersion,
      p_prompt_tokens: input.promptTokens,
      p_completion_tokens: input.completionTokens,
      p_latency_ms: input.latencyMs,
      p_synonyms: input.synonyms.map((synonym) => ({
        term: synonym.term,
        partOfSpeech: synonym.partOfSpeech,
        definition: synonym.definition,
        nuance: synonym.nuance,
      })),
    });

    if (error || !data) {
      throw new InternalError(
        `failed to save generation: ${error?.message ?? 'no id returned'}`,
        error,
      );
    }

    // 保存済みの行を読み戻す。LLM が返した Synonym は id を持たないため、
    // そのまま返すと source:"generated" の応答から synonyms[].id が欠落し、
    // キャッシュ応答との形が食い違う(api-spec.md では必須の uuid)。
    const synonyms = await this.loadSynonyms(data);

    return new SynonymGeneration(
      data,
      input.word,
      synonyms,
      input.model,
      input.promptVersion,
      new Date(),
    );
  }

  /** 指定した生成の類義語を sort_order 昇順で読み出す。 */
  private async loadSynonyms(generationId: string): Promise<Synonym[]> {
    const { data, error } = await this.client
      .from('synonyms')
      .select('id, term, part_of_speech, definition, nuance, sort_order')
      .eq('generation_id', generationId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new InternalError(`failed to load synonyms: ${error.message}`, error);
    }

    return data.map(
      (row) =>
        new Synonym(
          row.term,
          row.part_of_speech as PartOfSpeech | null,
          row.definition ?? '',
          row.nuance ?? '',
          row.sort_order,
          row.id,
        ),
    );
  }

  async recordCacheHit(
    userId: string,
    word: Word,
    generationId: string,
    rawInput: string,
  ): Promise<void> {
    const { error } = await this.client.from('search_history').insert({
      user_id: userId,
      word_id: word.id,
      generation_id: generationId,
      raw_input: rawInput,
      outcome: 'cache',
    });

    if (error) {
      throw new InternalError(`failed to record cache hit: ${error.message}`, error);
    }
  }

  async recordFailure(input: RecordFailureInput): Promise<void> {
    // 生成記録(status='failed')を先に作り、search_history から参照する。
    // これにより「LLMに到達した失敗」はすべて synonym_generations に残る
    // (docs/error-handling.md の失敗記録方針に合わせる)。
    const generation = await this.client
      .from('synonym_generations')
      .insert({
        word_id: input.word.id,
        model: input.model,
        prompt_version: input.promptVersion,
        status: 'failed',
        error_code: input.errorCode,
        prompt_tokens: input.promptTokens,
        completion_tokens: input.completionTokens,
        latency_ms: input.latencyMs,
      })
      .select('id')
      .single();

    if (generation.error) {
      throw new InternalError(
        `failed to record failed generation: ${generation.error.message}`,
        generation.error,
      );
    }

    const history = await this.client.from('search_history').insert({
      user_id: input.userId,
      word_id: input.word.id,
      generation_id: generation.data.id,
      raw_input: input.rawInput,
      outcome: 'failed',
    });

    if (history.error) {
      throw new InternalError(
        `failed to record failed search history: ${history.error.message}`,
        history.error,
      );
    }
  }
}
