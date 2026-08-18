import { z } from 'zod';
import type { TestEnv } from './TestEnv.ts';
import type { ErrorEnvelope } from '../../supabase/functions/_shared/http/ErrorResponseMapper.ts';

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
      // fetch がボディを許さないのは GET / HEAD のみ。ここを許可リスト方式にすると
      // 将来 DELETE などの 405 テストを足したときに黙ってボディなしで送られ、
      // 「違う理由で」テストが通ってしまう。
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
    });

    return {
      status: response.status,
      body: await this.readBody(response),
      headers: response.headers,
    };
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

  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

// 外部からの応答は unknown で受けて検証で絞り込む(CLAUDE.md の TypeScript 規約)。
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    retryAfterSeconds: z.number().optional(),
    requestId: z.string(),
  }),
});

/**
 * エラーエンベロープ(docs/api-spec.md)の形を検証しつつ取り出す。
 * 戻り値の型を本体の ErrorEnvelope に合わせているため、
 * サーバ側でフィールドが増減すると型エラーとしてここで気づける。
 */
export function expectErrorEnvelope(body: unknown): ErrorEnvelope['error'] {
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `エラーエンベロープの形ではありません: ${JSON.stringify(body)} (${parsed.error.message})`,
    );
  }
  return parsed.data.error as ErrorEnvelope['error'];
}
