import { z } from 'zod';
import { ApiError, isKnownApiErrorCode } from './ApiError';

// docs/api-spec.md 2.4 のエラー本文形式。外部入力なので zod で検証する。
const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
  }),
});

const FALLBACK_MESSAGE = 'エラーが発生しました。もう一度お試しください。';

/** 非 2xx レスポンスを ApiError に変換する。未知の code は internal_error に丸める。 */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return new ApiError('internal_error', FALLBACK_MESSAGE);
  }

  const parsed = errorBodySchema.safeParse(json);
  if (!parsed.success) {
    return new ApiError('internal_error', FALLBACK_MESSAGE);
  }

  const { code, message, retryAfterSeconds } = parsed.data.error;
  const safeCode = isKnownApiErrorCode(code) ? code : 'internal_error';

  return new ApiError(safeCode, message, retryAfterSeconds);
}
