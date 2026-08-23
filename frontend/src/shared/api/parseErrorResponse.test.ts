import { describe, it, expect } from 'vitest';
import { parseErrorResponse } from './parseErrorResponse';
import { ApiError, isKnownApiErrorCode } from './ApiError';

/**
 * docs/api-spec.md 2.4 のエラー本文をクライアント側の型へ写す処理。
 *
 * ここで使う Response はプラットフォーム標準のオブジェクトであって、
 * モックではない(ADR-0016)。実際のサーバーが返すのと同じ形の本文を組み立てて
 * 渡している。
 */
function errorResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('parseErrorResponse', () => {
  it('既知の code と message をそのまま写す', async () => {
    const error = await parseErrorResponse(
      errorResponse({ error: { code: 'rate_limited', message: '上限に達しました。' } }, 429),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('rate_limited');
    expect(error.userMessage).toBe('上限に達しました。');
  });

  it('retryAfterSeconds を取り込む', async () => {
    const error = await parseErrorResponse(
      errorResponse(
        { error: { code: 'rate_limited', message: '上限に達しました。', retryAfterSeconds: 480 } },
        429,
      ),
    );

    expect(error.retryAfterSeconds).toBe(480);
  });

  it('retryAfterSeconds が無ければ undefined のまま', async () => {
    const error = await parseErrorResponse(
      errorResponse({ error: { code: 'upstream_timeout', message: '時間がかかっています。' } }, 504),
    );

    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it('未知の code は internal_error に丸める', async () => {
    // サーバーが将来新しい code を足しても、古いクライアントが壊れないようにする。
    const error = await parseErrorResponse(
      errorResponse({ error: { code: 'brand_new_code', message: 'なにか新しいエラー。' } }, 500),
    );

    expect(error.code).toBe('internal_error');
    // message はサーバーのものを保つ(表示できる日本語である前提)。
    expect(error.userMessage).toBe('なにか新しいエラー。');
  });

  it('JSON として壊れている本文でも例外を投げず internal_error を返す', async () => {
    const error = await parseErrorResponse(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    );

    expect(error.code).toBe('internal_error');
    expect(error.userMessage.length).toBeGreaterThan(0);
  });

  it('想定した形でない JSON でも internal_error を返す', async () => {
    for (const body of [{}, { error: {} }, { error: { code: 'x' } }, { message: 'x' }, null, []]) {
      const error = await parseErrorResponse(errorResponse(body, 500));
      expect(error.code).toBe('internal_error');
    }
  });

  it('本文の空レスポンスでも落ちない', async () => {
    const error = await parseErrorResponse(new Response(null, { status: 500 }));

    expect(error.code).toBe('internal_error');
  });
});

describe('isKnownApiErrorCode', () => {
  it('docs/api-spec.md 2.5 のコードをすべて認識する', () => {
    const fromSpec = [
      'invalid_request',
      'unauthorized',
      'rate_limited',
      'upstream_rate_limited',
      'upstream_timeout',
      'upstream_unavailable',
      'upstream_invalid_response',
      'internal_error',
    ];

    for (const code of fromSpec) {
      expect(isKnownApiErrorCode(code)).toBe(true);
    }
  });

  it('network_error はサーバーから来ないコードなので既知に含めない', () => {
    // クライアント内部で組み立てるコード(オフライン時など)。
    // サーバーの本文からこれが来ることはない。
    expect(isKnownApiErrorCode('network_error')).toBe(false);
  });

  it('未知の文字列を拒否する', () => {
    for (const code of ['', 'INTERNAL_ERROR', 'nope']) {
      expect(isKnownApiErrorCode(code)).toBe(false);
    }
  });
});
