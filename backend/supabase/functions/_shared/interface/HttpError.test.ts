import assert from 'node:assert/strict';
import { mapDomainErrorToHttp } from './HttpError.ts';
import {
  InternalDomainError,
  InvalidWordError,
  RateLimitExceededError,
  UnauthorizedError,
  UpstreamInvalidResponseError,
  UpstreamRateLimitedError,
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '../domain/errors.ts';

// docs/api-spec.md 2.5 のエラーコード一覧は表で書かれているので、表としてテストする。
// この写像がずれると、クライアントのフォールバック UX(docs/frontend-design.md 7)が
// 丸ごと誤動作する。

const CASES: readonly [string, () => unknown, number, string][] = [
  ['InvalidWordError', () => new InvalidWordError('bad word'), 400, 'invalid_request'],
  ['UnauthorizedError', () => new UnauthorizedError('no jwt'), 401, 'unauthorized'],
  [
    'RateLimitExceededError',
    () => new RateLimitExceededError('too many', 480),
    429,
    'rate_limited',
  ],
  [
    'UpstreamRateLimitedError',
    () => new UpstreamRateLimitedError('deepseek 429', 30),
    429,
    'upstream_rate_limited',
  ],
  ['UpstreamTimeoutError', () => new UpstreamTimeoutError('timed out'), 504, 'upstream_timeout'],
  [
    'UpstreamUnavailableError',
    () => new UpstreamUnavailableError('deepseek 503'),
    502,
    'upstream_unavailable',
  ],
  [
    'UpstreamInvalidResponseError',
    () => new UpstreamInvalidResponseError('schema mismatch'),
    502,
    'upstream_invalid_response',
  ],
  ['InternalDomainError', () => new InternalDomainError('boom'), 500, 'internal_error'],
];

for (const [name, create, expectedStatus, expectedCode] of CASES) {
  Deno.test(`mapDomainErrorToHttp: ${name} → ${expectedStatus} / ${expectedCode}`, () => {
    const mapped = mapDomainErrorToHttp(create());

    assert.deepStrictEqual(mapped.status, expectedStatus);
    assert.deepStrictEqual(mapped.body.error.code, expectedCode);
  });
}

Deno.test('mapDomainErrorToHttp: 未知の例外は 500 internal_error に丸める', () => {
  for (const thrown of [new Error('unexpected'), 'a string', null, undefined, { code: 'nope' }]) {
    const mapped = mapDomainErrorToHttp(thrown);

    assert.deepStrictEqual(mapped.status, 500);
    assert.deepStrictEqual(mapped.body.error.code, 'internal_error');
  }
});

Deno.test('mapDomainErrorToHttp: どのケースでも表示可能な message が入る', () => {
  for (const [, create] of CASES) {
    const mapped = mapDomainErrorToHttp(create());

    // クライアントはこの message をそのまま画面に出す(docs/frontend-design.md 6.2)。
    assert.deepStrictEqual(typeof mapped.body.error.message, 'string');
    assert.deepStrictEqual(mapped.body.error.message.length > 0, true);
  }
});

Deno.test('mapDomainErrorToHttp: 429 は本文と Retry-After ヘッダの両方に秒数を載せる', () => {
  const mapped = mapDomainErrorToHttp(new RateLimitExceededError('too many', 480));

  assert.deepStrictEqual(mapped.body.error.retryAfterSeconds, 480);
  // docs/api-spec.md 3.3: 本文のフィールドだけでは標準の HTTP クライアントが解釈できない。
  assert.deepStrictEqual(new Headers(mapped.headers).get('retry-after'), '480');
});

Deno.test('mapDomainErrorToHttp: retryAfterSeconds が無い上流 429 はヘッダを付けない', () => {
  const mapped = mapDomainErrorToHttp(new UpstreamRateLimitedError('deepseek 429', null));

  assert.deepStrictEqual(mapped.status, 429);
  assert.deepStrictEqual(mapped.body.error.retryAfterSeconds, undefined);
  assert.deepStrictEqual(new Headers(mapped.headers).get('retry-after'), null);
});

Deno.test('mapDomainErrorToHttp: 429 以外は Retry-After を付けない', () => {
  for (const create of [() => new InvalidWordError('x'), () => new UpstreamTimeoutError('x')]) {
    const mapped = mapDomainErrorToHttp(create());
    assert.deepStrictEqual(new Headers(mapped.headers).get('retry-after'), null);
  }
});
