/**
 * generate-synonyms などの Edge Function が返すエラーエンベロープ
 * (docs/api-spec.md)をクライアント側の例外に変換したもの。
 *
 * 画面は `code` で分岐せず、原則として `message` をそのまま表示する
 * (表示可能な日本語を返すのはサーバ側の責務。docs/error-handling.md)。
 * 例外は `rate_limited`(待ち時間の算出)と `unauthorized`(リダイレクト)のみ。
 */
export class ApiError extends Error {
  private constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly requestId: string | undefined,
    readonly retryAfterSeconds: number | undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Edge Function から届いた JSON レスポンス(2xx 以外)を変換する。 */
  static fromResponseBody(body: unknown): ApiError {
    const envelope = ApiError.parseEnvelope(body);
    if (!envelope) {
      return new ApiError(
        '予期しないエラーが発生しました。もう一度お試しください。',
        'internal_error',
        true,
        undefined,
        undefined,
      );
    }
    return new ApiError(
      envelope.message,
      envelope.code,
      envelope.retryable,
      envelope.requestId,
      envelope.retryAfterSeconds,
    );
  }

  /** fetch 自体が失敗した場合(オフライン・DNS 到達不可など)。 */
  static fromNetworkFailure(cause: unknown): ApiError {
    const error = new ApiError(
      'オフラインです。接続を確認してください。',
      'offline',
      true,
      undefined,
      undefined,
    );
    error.cause = cause;
    return error;
  }

  private static parseEnvelope(body: unknown): {
    message: string;
    code: string;
    retryable: boolean;
    requestId: string | undefined;
    retryAfterSeconds: number | undefined;
  } | null {
    if (typeof body !== 'object' || body === null || !('error' in body)) {
      return null;
    }
    const inner = (body as { error: unknown }).error;
    if (typeof inner !== 'object' || inner === null) {
      return null;
    }
    const e = inner as Record<string, unknown>;
    if (typeof e.code !== 'string' || typeof e.message !== 'string') {
      return null;
    }
    return {
      code: e.code,
      message: e.message,
      retryable: typeof e.retryable === 'boolean' ? e.retryable : true,
      requestId: typeof e.requestId === 'string' ? e.requestId : undefined,
      retryAfterSeconds:
        typeof e.retryAfterSeconds === 'number' ? e.retryAfterSeconds : undefined,
    };
  }
}
