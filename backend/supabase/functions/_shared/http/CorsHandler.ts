/** 統合テストからも参照するため export する(テスト側での再ハードコードを避ける)。 */
export const ALLOWED_HEADERS = 'authorization, content-type';
export const ALLOWED_METHODS = 'POST, OPTIONS';

/** CORS ヘッダの生成とプリフライト(OPTIONS)応答を担当する。 */
export class CorsHandler {
  constructor(private readonly allowedOrigin: string) {}

  headers(): HeadersInit {
    return {
      'Access-Control-Allow-Origin': this.allowedOrigin,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Max-Age': '86400',
    };
  }

  preflightResponse(): Response {
    return new Response(null, { status: 204, headers: this.headers() });
  }
}
