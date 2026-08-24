// docs/llm-integration.md 5.3 のエラー階層。
// HTTP ステータスコードへの写像は Interface 層(HttpError.ts)にのみ存在させる。
// Domain / Application はここでは HTTP を一切知らない。

export type DomainErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_invalid_response'
  | 'internal_error';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidWordError extends DomainError {
  readonly code = 'invalid_request' as const;
}

export class UnauthorizedError extends DomainError {
  readonly code = 'unauthorized' as const;
}

export class RateLimitExceededError extends DomainError {
  readonly code = 'rate_limited' as const;
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
  }
}

export class UpstreamRateLimitedError extends DomainError {
  readonly code = 'upstream_rate_limited' as const;
  constructor(message: string, readonly retryAfterSeconds: number | null, cause?: unknown) {
    super(message, cause);
  }
}

export class UpstreamTimeoutError extends DomainError {
  readonly code = 'upstream_timeout' as const;
}

export class UpstreamUnavailableError extends DomainError {
  readonly code = 'upstream_unavailable' as const;
}

export class UpstreamInvalidResponseError extends DomainError {
  readonly code = 'upstream_invalid_response' as const;
}

export class InternalDomainError extends DomainError {
  readonly code = 'internal_error' as const;
}
