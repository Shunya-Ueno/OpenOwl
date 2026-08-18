/**
 * Edge Function 経由ではない失敗(PostgREST への直接クエリなど)を表すエラー。
 * `ApiError`(docs/api-spec.md のエラーエンベロープ)とは発生源が異なるため区別する。
 */
export class InternalAppError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InternalAppError';
  }
}
