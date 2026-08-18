export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';

/** 生成された類義語1件(docs/api-spec.md のレスポンスに対応)。 */
export class Synonym {
  constructor(
    readonly id: string,
    readonly sortOrder: number,
    readonly term: string,
    readonly partOfSpeech: PartOfSpeech | null,
    readonly definition: string,
    readonly nuance: string,
  ) {}
}
