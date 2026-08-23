import type { SynonymResult } from '../domain/SynonymResult';

export interface GenerateSynonymsInput {
  readonly word: string;
  readonly maxResults?: number;
  readonly forceRefresh?: boolean;
}

/**
 * port。テストダブル差し替えのためではなく、依存方向の制御と将来の
 * 実装差し替えのために存在する(docs/frontend-design.md 6、backend と同じ方針)。
 * @throws ApiError
 */
export interface SynonymsApi {
  generate(input: GenerateSynonymsInput): Promise<SynonymResult>;
}
