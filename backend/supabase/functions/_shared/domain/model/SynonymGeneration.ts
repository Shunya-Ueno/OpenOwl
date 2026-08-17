import type { Word } from './Word.ts';
import type { Synonym } from './Synonym.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 1回の生成結果(synonym_generations + synonyms の集約)。 */
export class SynonymGeneration {
  constructor(
    readonly id: string,
    readonly word: Word,
    readonly synonyms: readonly Synonym[],
    readonly model: string,
    readonly promptVersion: string,
    readonly generatedAt: Date,
  ) {}

  /** キャッシュとして再利用してよいか(TTL判定)。 */
  isFreshAt(now: Date, ttlDays: number): boolean {
    const ageMs = now.getTime() - this.generatedAt.getTime();
    return ageMs <= ttlDays * DAY_MS;
  }
}
