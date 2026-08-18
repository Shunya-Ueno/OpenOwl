import type { Synonym } from './Synonym';
import type { GeneratedWord } from './SynonymGeneration';

// search_history.outcome の CHECK 制約と揃える。'failed' 行は一覧では除外するが、
// getById では取得されうるため型としては表現しておく。
export type HistoryOutcome = 'generated' | 'cache' | 'failed';

export interface HistoryGeneration {
  readonly id: string;
  readonly createdAt: Date;
  readonly synonyms: readonly Synonym[];
}

/** search_history の1行(失敗行は一覧に含めない。docs/frontend/screens.md)。 */
export class SearchHistoryEntry {
  constructor(
    readonly id: string,
    readonly rawInput: string,
    readonly outcome: HistoryOutcome,
    readonly createdAt: Date,
    readonly word: GeneratedWord,
    readonly generation: HistoryGeneration | null,
  ) {}
}
