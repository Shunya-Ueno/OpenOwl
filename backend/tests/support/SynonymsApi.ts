import type { TestEnv } from './TestEnv.ts';

export interface SynonymsApiResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Headers;
}

/**
 * generate-synonyms を HTTP で叩くための薄いクライアント。
 *
 * supabase-js の functions.invoke ではなく生の fetch を使うのは、
 * ステータスコードとヘッダ(CORS)を docs/api-spec.md どおりに検証するため。
 * SDK を挟むとこれらが抽象化されて確認できない。
 */
export class SynonymsApi {
  constructor(private readonly env: TestEnv) {}

  async generate(
    accessToken: string | null,
    body: unknown,
    method = 'POST',
  ): Promise<SynonymsApiResponse> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (accessToken) headers['authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(this.env.functionUrl('generate-synonyms'), {
      method,
      headers,
      ...(method === 'POST' || method === 'PUT' ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    return { status: response.status, body: parsed, headers: response.headers };
  }

  async preflight(): Promise<SynonymsApiResponse> {
    const response = await fetch(this.env.functionUrl('generate-synonyms'), {
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    });
    return { status: response.status, body: null, headers: response.headers };
  }
}

/** エラーエンベロープ(docs/api-spec.md)の形を検証しつつ取り出す。 */
export function expectErrorEnvelope(body: unknown): {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
} {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    throw new Error(`エラーエンベロープの形ではありません: ${JSON.stringify(body)}`);
  }
  const error = (body as { error: Record<string, unknown> }).error;
  if (
    typeof error.code !== 'string' ||
    typeof error.message !== 'string' ||
    typeof error.retryable !== 'boolean' ||
    typeof error.requestId !== 'string'
  ) {
    throw new Error(`エラーエンベロープのフィールドが不足しています: ${JSON.stringify(body)}`);
  }
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    requestId: error.requestId,
  };
}
