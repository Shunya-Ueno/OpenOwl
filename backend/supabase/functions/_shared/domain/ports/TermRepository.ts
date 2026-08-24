import type { Term } from '../Term.ts';

export interface ResolvedTerm {
  readonly id: string;
  readonly displayText: string;
  readonly language: string;
}

export interface TermRepository {
  /** find_or_create_term RPC 経由。同時実行でも1行に収束する。 */
  findOrCreate(term: Term): Promise<ResolvedTerm>;
}
