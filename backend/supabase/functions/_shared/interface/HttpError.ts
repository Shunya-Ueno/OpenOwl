import {
  DomainError,
  InvalidWordError,
  UnauthorizedError,
  RateLimitExceededError,
  UpstreamRateLimitedError,
  UpstreamTimeoutError,
  UpstreamUnavailableError,
  UpstreamInvalidResponseError,
} from '../domain/errors.ts';

// docs/api-spec.md 2.5 のエラーコード一覧に対応する、例外 → HTTP の唯一の写像先。
// Domain / Application 層は HTTP ステータスコードを一切知らない
// (docs/llm-integration.md 5.3)。

export interface HttpErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly retryAfterSeconds?: number;
  };
}

export interface MappedError {
  readonly status: number;
  readonly body: HttpErrorBody;
}

const MESSAGES: Record<string, string> = {
  invalid_request: '入力内容を確認してください。英単語を1つ、64文字以内で入力してください。',
  unauthorized: '認証が必要です。再度ログインしてください。',
  rate_limited: '1時間あたりの生成回数の上限に達しました。しばらくしてからお試しください。',
  upstream_rate_limited: '混雑しています。しばらくしてからもう一度お試しください。',
  upstream_timeout: '時間がかかっています。もう一度お試しください。',
  upstream_unavailable: '一時的に利用できません。しばらくしてからもう一度お試しください。',
  upstream_invalid_response: '結果を取得できませんでした。もう一度お試しください。',
  internal_error: 'エラーが発生しました。もう一度お試しください。',
};

export function mapDomainErrorToHttp(error: unknown): MappedError {
  if (error instanceof InvalidWordError) return build(400, error.code);
  if (error instanceof UnauthorizedError) return build(401, error.code);
  if (error instanceof RateLimitExceededError) {
    return build(429, error.code, error.retryAfterSeconds);
  }
  if (error instanceof UpstreamRateLimitedError) {
    return build(429, error.code, error.retryAfterSeconds ?? undefined);
  }
  if (error instanceof UpstreamTimeoutError) return build(504, error.code);
  if (error instanceof UpstreamUnavailableError) return build(502, error.code);
  if (error instanceof UpstreamInvalidResponseError) return build(502, error.code);
  if (error instanceof DomainError) return build(500, 'internal_error');
  return build(500, 'internal_error');
}

function build(status: number, code: string, retryAfterSeconds?: number): MappedError {
  return {
    status,
    body: {
      error: {
        code,
        message: MESSAGES[code] ?? MESSAGES.internal_error,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
    },
  };
}
