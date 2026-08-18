/**
 * api-spec.md で定義されたエラーコード。
 * ここに追加する場合は必ず docs/api-spec.md も同じ変更で更新すること。
 */
export type ErrorCode =
  | 'invalid_request'
  | 'unsupported_language'
  | 'unauthorized'
  | 'method_not_allowed'
  | 'not_a_known_word'
  | 'rate_limited'
  | 'llm_output_truncated'
  | 'llm_invalid_response'
  | 'llm_unavailable'
  | 'llm_timeout'
  | 'internal_error';

/** LLM 呼び出しの計測値。失敗時の synonym_generations 記録に使う。 */
export interface GenerationTelemetry {
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly latencyMs: number;
}

/**
 * アプリケーション内で発生しうるすべてのエラーの基底クラス。
 * 自分の HTTP 表現(httpStatus / code / retryable / userMessage)を知っているため、
 * ErrorResponseMapper は分岐せずに直列化するだけで済む。
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;
  abstract readonly retryable: boolean;
  abstract readonly userMessage: string;

  // `cause` は ES2022 以降の Error が持つメンバーなので、override を明示する
  // (Deno は noImplicitOverride が既定で有効なため、付けないと TS4115 になる)。
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = 'invalid_request' as const;
  readonly httpStatus = 400;
  readonly retryable = false;
  readonly userMessage = '英単語を1つ入力してください(英字のみ、64文字以内)。';
}

export class UnsupportedLanguageError extends AppError {
  readonly code = 'unsupported_language' as const;
  readonly httpStatus = 400;
  readonly retryable = false;
  readonly userMessage = '現在は英単語のみに対応しています。';
}

export class UnauthorizedError extends AppError {
  readonly code = 'unauthorized' as const;
  readonly httpStatus = 401;
  readonly retryable = false;
  readonly userMessage = '認証が必要です。再度ログインしてください。';
}

export class MethodNotAllowedError extends AppError {
  readonly code = 'method_not_allowed' as const;
  readonly httpStatus = 405;
  readonly retryable = false;
  readonly userMessage = '許可されていないメソッドです。';
}

export class NotAKnownWordError extends AppError {
  readonly code = 'not_a_known_word' as const;
  readonly httpStatus = 422;
  readonly retryable = false;
  readonly userMessage = '英単語として認識できませんでした。スペルをご確認ください。';

  constructor(message: string, readonly telemetry: GenerationTelemetry, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * レート制限の基底クラス。上限の種類によってユーザーへの説明が変わるため、
 * userMessage はサブクラスで定義する(「毎分バースト」と「1日の上限」を混同させない)。
 */
export abstract class RateLimitError extends AppError {
  readonly code = 'rate_limited' as const;
  readonly httpStatus = 429;
  readonly retryable = true;

  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
  }
}

/** 1日あたりの生成上限の超過。LLM のコスト上限。 */
export class DailyRateLimitError extends RateLimitError {
  readonly userMessage =
    '本日の生成回数の上限に達しました。保存済みの履歴はいつでも見返せます。';
}

/** 毎分あたりのリクエスト上限の超過。短時間の集中を抑えるためのもの。 */
export class BurstRateLimitError extends RateLimitError {
  readonly userMessage =
    'リクエストが短時間に集中しています。少し待ってからお試しください。';
}

/**
 * LLM の出力が maxOutputTokens に達して途中で切れた場合。
 *
 * 同じ入力なら決定的に再発するため retryable = false とする
 * (retryable にすると、必ず失敗する生成にフル課金でもう1回払うことになる)。
 */
export class LlmOutputTruncatedError extends AppError {
  readonly code = 'llm_output_truncated' as const;
  readonly httpStatus = 502;
  readonly retryable = false;
  readonly userMessage = 'この単語の結果を取得できませんでした。別の単語でお試しください。';

  constructor(message: string, readonly telemetry: GenerationTelemetry, cause?: unknown) {
    super(message, cause);
  }
}

export class LlmInvalidResponseError extends AppError {
  readonly code = 'llm_invalid_response' as const;
  readonly httpStatus = 502;
  readonly retryable = true;
  readonly userMessage = '結果をうまく取得できませんでした。もう一度お試しください。';

  constructor(message: string, readonly telemetry: GenerationTelemetry, cause?: unknown) {
    super(message, cause);
  }
}

export class LlmUnavailableError extends AppError {
  readonly code = 'llm_unavailable' as const;
  readonly httpStatus = 503;
  readonly retryable = true;
  readonly userMessage = 'ただいま混み合っています。少し時間をおいてお試しください。';

  constructor(message: string, readonly telemetry: GenerationTelemetry, cause?: unknown) {
    super(message, cause);
  }
}

export class LlmTimeoutError extends AppError {
  readonly code = 'llm_timeout' as const;
  readonly httpStatus = 504;
  readonly retryable = true;
  readonly userMessage = '生成に時間がかかっています。もう一度お試しください。';

  constructor(message: string, readonly telemetry: GenerationTelemetry, cause?: unknown) {
    super(message, cause);
  }
}

export class InternalError extends AppError {
  readonly code = 'internal_error' as const;
  readonly httpStatus = 500;
  readonly retryable = true;
  readonly userMessage = 'エラーが発生しました。もう一度お試しください。';
}
