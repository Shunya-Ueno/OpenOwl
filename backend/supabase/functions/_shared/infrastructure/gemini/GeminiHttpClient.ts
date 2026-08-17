import {
  InternalError,
  LlmInvalidResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from '../../domain/error/AppError.ts';

const MAX_ATTEMPTS = 2; // 初回 + リトライ1回まで(429/5xx/ネットワークエラーのみ)
const RETRY_BASE_DELAY_MS = 500;

export interface GeminiRawResponse {
  readonly body: unknown;
  readonly latencyMs: number;
}

/** Gemini からの非2xx応答。ステータスに応じてリトライ可否を判定するための内部エラー。 */
class GeminiHttpError extends Error {
  constructor(readonly status: number, readonly retryable: boolean) {
    super(`gemini http error: ${status}`);
  }
}

/**
 * 2xx で返ってきた本文が JSON として壊れていた場合の内部エラー。
 * この時点で生成は課金済みなので、再送しては絶対にいけない。
 */
class GeminiBodyParseError extends Error {
  constructor(readonly parseCause: unknown) {
    super('gemini response body was not valid JSON');
  }
}

/**
 * Gemini REST API への HTTP 呼び出しを担当する。
 * タイムアウト・リトライ・エラー分類のみを行い、応答内容の解釈は SynonymPrompt に委ねる。
 *
 * リトライ方針(docs/backend-design.md):
 *   - ネットワークエラー / 429 / 5xx → 1回だけ再試行する
 *   - タイムアウト → 再試行しない(既に待機済み)
 *   - その他の4xx → 再試行しない(送り直しても必ず同じ結果)
 */
export class GeminiHttpClient {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  async post(model: string, body: unknown): Promise<GeminiRawResponse> {
    const startedAt = performance.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const responseBody = await this.attempt(model, body);
        return { body: responseBody, latencyMs: Math.round(performance.now() - startedAt) };
      } catch (error) {
        lastError = error;
        const shouldRetry = attempt < MAX_ATTEMPTS && this.isRetryable(error);
        if (!shouldRetry) break;
        await this.delay(RETRY_BASE_DELAY_MS + Math.random() * RETRY_BASE_DELAY_MS);
      }
    }

    throw this.toAppError(lastError, Math.round(performance.now() - startedAt));
  }

  private async attempt(model: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new GeminiHttpError(response.status, retryable);
      }

      try {
        return await response.json();
      } catch (error) {
        throw new GeminiBodyParseError(error);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof GeminiHttpError) return error.retryable;
    // 課金済みの応答が壊れていただけなので、再送は純粋な二重課金になる。
    if (error instanceof GeminiBodyParseError) return false;
    if (this.isAbortError(error)) return false;
    // fetch 自体が失敗した場合(DNS・接続断など)。トークンは消費していない。
    return error instanceof TypeError;
  }

  private toAppError(error: unknown, latencyMs: number): Error {
    const telemetry = { promptTokens: null, completionTokens: null, latencyMs };

    if (this.isAbortError(error)) {
      return new LlmTimeoutError('gemini request timed out', telemetry, error);
    }
    if (error instanceof GeminiBodyParseError) {
      return new LlmInvalidResponseError(error.message, telemetry, error.parseCause);
    }
    if (error instanceof GeminiHttpError && !error.retryable) {
      // 429/5xx 以外の4xx。送り直しても解決しない実装上の問題として扱う。
      return new InternalError(`gemini request rejected: ${error.message}`, error);
    }
    if (error instanceof GeminiHttpError || error instanceof TypeError) {
      return new LlmUnavailableError('gemini request failed', telemetry, error);
    }
    return new InternalError('unexpected error while calling gemini', error);
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
