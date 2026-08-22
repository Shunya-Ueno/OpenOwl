import {
  UpstreamRateLimitedError,
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '../../domain/errors.ts';

export interface ChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export interface ChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly maxTokens: number;
  readonly temperature: number;
  readonly jsonMode: boolean;
}

export interface ChatCompletionResponse {
  readonly content: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cachedPromptTokens: number | null;
  readonly latencyMs: number;
}

/**
 * DeepSeek への HTTP 層。docs/llm-integration.md 4.4。
 * 認証ヘッダ・タイムアウト・リトライ判定・HTTPエラー→ドメイン例外の変換のみを知る。
 * プロンプトの中身やドメインのことは一切知らない。
 */
export class DeepSeekClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  /**
   * @throws UpstreamTimeoutError | UpstreamRateLimitedError | UpstreamUnavailableError
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startedAt = performance.now();

    let lastError: unknown;
    // docs/llm-integration.md 5.1: リトライは最大1回。429/5xx/ネットワークエラーのみ。
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        return await this.attempt(request, startedAt);
      } catch (error) {
        lastError = error;
        if (attempt === 1 || !this.isRetryable(error)) break;

        const delayMs = this.retryDelayMs(error);
        if (delayMs === null) break; // Retry-After が予算を超える場合は諦める
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private async attempt(
    request: ChatCompletionRequest,
    startedAt: number,
  ): Promise<ChatCompletionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      const latencyMs = Math.round(performance.now() - startedAt);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = this.parseRetryAfter(response.headers.get('retry-after'));
          throw new UpstreamRateLimitedError(
            `deepseek returned 429`,
            retryAfter,
          );
        }
        if (response.status >= 500) {
          throw new UpstreamUnavailableError(`deepseek returned ${response.status}`);
        }
        // 4xx(429以外)はリトライ対象外の異常応答。呼び出し側の実装不備とみなす。
        throw new UpstreamUnavailableError(`deepseek returned unexpected status ${response.status}`);
      }

      const body = await response.json();
      const choice = body?.choices?.[0];
      const content: unknown = choice?.message?.content;

      if (typeof content !== 'string') {
        throw new UpstreamUnavailableError('deepseek response missing choices[0].message.content');
      }

      return {
        content,
        promptTokens: body?.usage?.prompt_tokens ?? null,
        completionTokens: body?.usage?.completion_tokens ?? null,
        cachedPromptTokens: body?.usage?.prompt_cache_hit_tokens ?? null,
        latencyMs,
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new UpstreamTimeoutError('deepseek request timed out', error);
      }
      if (
        error instanceof UpstreamRateLimitedError ||
        error instanceof UpstreamUnavailableError
      ) {
        throw error;
      }
      // fetch 自体が失敗(DNS・接続拒否等)した場合は TypeError になる。
      throw new UpstreamUnavailableError('deepseek request failed', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof UpstreamRateLimitedError || error instanceof UpstreamUnavailableError;
  }

  /** Retry-After が残りのタイムアウト予算を超える場合は null(=リトライしない)を返す。 */
  private retryDelayMs(error: unknown): number | null {
    if (error instanceof UpstreamRateLimitedError && error.retryAfterSeconds !== null) {
      const ms = error.retryAfterSeconds * 1000;
      return ms <= this.timeoutMs ? ms : null;
    }
    return 500 + Math.floor(Math.random() * 500);
  }

  private parseRetryAfter(value: string | null): number | null {
    if (!value) return null;
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
