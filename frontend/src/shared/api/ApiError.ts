/**
 * サーバーの code に 1:1 対応するエラー型。メッセージ文字列で分岐しない
 * (CLAUDE.md「エラーは型で表現する」)。docs/frontend-design.md 6.2。
 */
export type ApiErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_invalid_response'
  | 'internal_error'
  | 'network_error';

const KNOWN_CODES: readonly ApiErrorCode[] = [
  'invalid_request',
  'unauthorized',
  'rate_limited',
  'upstream_rate_limited',
  'upstream_timeout',
  'upstream_unavailable',
  'upstream_invalid_response',
  'internal_error',
];

export function isKnownApiErrorCode(value: string): value is ApiErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(value);
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly userMessage: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }
}
