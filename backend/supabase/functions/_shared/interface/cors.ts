// docs/security.md 5: * を使わない。ALLOWED_ORIGINS の完全一致で判定する。
// ネイティブアプリからのリクエストには Origin が付かないため、その場合は
// CORS ヘッダを返さずそのまま処理する。

export class CorsPolicy {
  private readonly allowedOrigins: readonly string[];

  constructor(allowedOriginsCsv: string) {
    this.allowedOrigins = allowedOriginsCsv.split(',').map((o) => o.trim()).filter(Boolean);
  }

  headersFor(request: Request): HeadersInit {
    const origin = request.headers.get('origin');
    if (!origin || !this.allowedOrigins.includes(origin)) {
      return {};
    }
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-max-age': '86400',
      vary: 'origin',
    };
  }

  preflightResponse(request: Request): Response {
    return new Response(null, { status: 204, headers: this.headersFor(request) });
  }
}
