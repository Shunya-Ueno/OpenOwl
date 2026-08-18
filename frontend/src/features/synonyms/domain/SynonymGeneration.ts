import type { Synonym } from './Synonym';

export type GenerationSource = 'generated' | 'cache';

export interface GeneratedWord {
  readonly id: string;
  readonly text: string;
  readonly language: string;
}

export interface UsageStatus {
  readonly dailyLimit: number;
  readonly remainingToday: number;
}

/** POST /generate-synonyms の成功レスポンス(docs/api-spec.md)。 */
export class SynonymGeneration {
  constructor(
    readonly requestId: string,
    readonly word: GeneratedWord,
    readonly source: GenerationSource,
    readonly generationId: string,
    readonly generatedAt: Date,
    readonly synonyms: readonly Synonym[],
    readonly usage: UsageStatus,
  ) {}
}
