export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';

/** 生成された類義語1件(synonyms テーブルの1行に対応)。 */
export class Synonym {
  constructor(
    readonly term: string,
    readonly partOfSpeech: PartOfSpeech | null,
    readonly definition: string,
    readonly nuance: string,
    readonly sortOrder: number,
    /** 永続化前(LLMからの生の結果)は未確定。 */
    readonly id?: string,
  ) {}
}
