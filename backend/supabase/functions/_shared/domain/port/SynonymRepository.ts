import type { WordText } from '../model/WordText.ts';
import type { Word } from '../model/Word.ts';
import type { Synonym } from '../model/Synonym.ts';
import type { SynonymGeneration } from '../model/SynonymGeneration.ts';

export interface SaveGenerationInput {
  readonly userId: string;
  readonly word: Word;
  readonly rawInput: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly synonyms: readonly Synonym[];
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly latencyMs: number;
}

export interface RecordFailureInput {
  readonly userId: string;
  readonly word: Word;
  readonly rawInput: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly errorCode: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly latencyMs: number | null;
}

/**
 * 永続化の抽象。プロバイダを差し替える具体的な理由がある箇所
 * (Supabase → 別基盤)にのみ存在する。テスト用フェイク実装の差し込み口ではない。
 */
export interface SynonymRepository {
  findOrCreateWord(text: WordText, language: string): Promise<Word>;

  /** 指定条件に一致する最新の成功済み生成を取得する(鮮度判定は呼び出し側が行う)。 */
  findLatestGeneration(
    word: Word,
    model: string,
    promptVersion: string,
  ): Promise<SynonymGeneration | null>;

  /** 生成記録・類義語・検索履歴を1トランザクションで原子的に保存する。 */
  saveGeneration(input: SaveGenerationInput): Promise<SynonymGeneration>;

  recordCacheHit(
    userId: string,
    word: Word,
    generationId: string,
    rawInput: string,
  ): Promise<void>;

  recordFailure(input: RecordFailureInput): Promise<void>;
}
