import { AppError, InternalError, RateLimitError, type ErrorCode } from '../domain/error/AppError.ts';
import type { StructuredLogger } from '../infrastructure/logging/StructuredLogger.ts';

interface ErrorEnvelope {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly retryAfterSeconds?: number;
    readonly requestId: string;
  };
}

/**
 * 例外を api-spec.md のエラーエンベロープに直列化する。
 * AppError が自身の httpStatus/code/retryable/userMessage を持つため、ここでは分岐しない。
 */
export class ErrorResponseMapper {
  constructor(private readonly logger: StructuredLogger) {}

  toResponse(error: unknown, requestId: string, corsHeaders: HeadersInit): Response {
    const appError = this.normalize(error);

    if (appError.httpStatus >= 500) {
      this.logger.error({
        requestId,
        outcome: 'unhandled_error',
        errorCode: appError.code,
        message: appError.message,
      });
    }

    const body: ErrorEnvelope = {
      error: {
        code: appError.code,
        message: appError.userMessage,
        retryable: appError.retryable,
        requestId,
        ...(appError instanceof RateLimitError
          ? { retryAfterSeconds: appError.retryAfterSeconds }
          : {}),
      },
    };

    return new Response(JSON.stringify(body), {
      status: appError.httpStatus,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  private normalize(error: unknown): AppError {
    if (error instanceof AppError) return error;
    return new InternalError('unexpected error', error);
  }
}
