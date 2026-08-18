import type { Synonym } from './Synonym';
import type { GeneratedWord } from './SynonymGeneration';

export type HistoryOutcome = 'generated' | 'cache';

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
