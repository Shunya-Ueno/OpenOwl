// リクエスト JSON の形状検証(zod)は Interface 層で行う。
// ここに渡ってくる時点で word/language/maxResults/forceRefresh は型として正しいことが
// 保証されている。ただし word の文字種・長さの検証は Term.fromInput が担う
// (docs/api-spec.md 3.1 の二重チェック)。

export interface GenerateSynonymsCommand {
  readonly userId: string;
  readonly word: string;
  readonly language: string;
  readonly maxResults: number;
  readonly forceRefresh: boolean;
}

export interface GenerateSynonymsResult {
  readonly term: {
    readonly id: string;
    readonly text: string;
    readonly language: string;
  };
  readonly generation: {
    // 永続化に失敗した場合(docs/api-spec.md 3.5 手順10の注記)は null になる。
    // その場合、この結果は履歴にもキャッシュにも残らない。
    readonly id: string | null;
    readonly model: string;
    readonly createdAt: string;
    readonly cached: boolean;
    readonly stale: boolean;
  };
  readonly synonyms: readonly {
    readonly text: string;
    readonly partOfSpeech: string | null;
    readonly register: string | null;
    readonly nuance: string | null;
  }[];
}
