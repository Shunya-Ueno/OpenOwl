import type { Synonym } from './Synonym.ts';

export interface TokenUsage {
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cachedPromptTokens: number | null;
}

/**
 * DeepSeek への1回の生成呼び出しに対応する集約ルート。docs/db-schema.md 3.3。
 * どの語(Term)に対する生成かは呼び出し側(GenerateSynonymsUseCase)が
 * ResolvedTerm として別に保持するため、ここでは持たない(責務の重複を避ける)。
 * TTL 判定(新鮮かどうか)はこのクラスの責務にする — DB 行の生の created_at を
 * 上位層に漏らさないため。
 */
export class SynonymGeneration {
  constructor(
    readonly id: string,
    readonly synonyms: readonly Synonym[],
    readonly model: string,
    readonly promptVersion: string,
    readonly createdAt: Date,
    readonly usage: TokenUsage,
  ) {}

  isFreshAt(now: Date, ttlDays: number): boolean {
    const ageMs = now.getTime() - this.createdAt.getTime();
    return ageMs <= ttlDays * 24 * 60 * 60 * 1000;
  }
}
