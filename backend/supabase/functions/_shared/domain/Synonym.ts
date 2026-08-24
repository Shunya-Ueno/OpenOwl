export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';
export type Register = 'formal' | 'neutral' | 'informal';

/** 生成された類義語1件。docs/db-schema.md 3.4。 */
export class Synonym {
  constructor(
    readonly text: string,
    readonly partOfSpeech: PartOfSpeech | null,
    readonly register: Register | null,
    readonly nuance: string | null,
  ) {}
}
