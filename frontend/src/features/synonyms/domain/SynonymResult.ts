/**
 * docs/api-spec.md 3.2 のレスポンス形状に対応するドメイン表現。
 * mutation の結果(Edge Function)と PostgREST から読んだ保存済み結果の両方を
 * この型に正規化してから画面へ渡す(docs/frontend-design.md 5.4)。
 */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';
export type Register = 'formal' | 'neutral' | 'informal';

export interface SynonymItem {
  readonly text: string;
  readonly partOfSpeech: PartOfSpeech | null;
  readonly register: Register | null;
  readonly nuance: string | null;
}

export interface SynonymResult {
  readonly term: {
    readonly id: string;
    readonly text: string;
    readonly language: string;
  };
  readonly generation: {
    readonly id: string | null;
    readonly model: string;
    readonly createdAt: string;
    readonly cached: boolean;
    readonly stale: boolean;
  };
  readonly synonyms: readonly SynonymItem[];
}
