import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/ApiError';

/**
 * リトライ判定を1箇所に集約する(docs/frontend/state-management.md)。
 *
 * - `retryable: false` のエラーは絶対に自動リトライしない。
 * - `rate_limited` は retryable=true だが、待ち時間が長い(毎分バーストで60秒、
 *   1日の上限で数時間)ため自動リトライの対象から除外し、UI 側で待機時間を示す。
 * - サーバ側も最大1回リトライするため、クライアント側は最大1回に留める
 *   (合わせて1リクエストあたり最大4回の Gemini 呼び出しに収める)。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
    mutations: {
      retry: (failureCount, error) =>
        error instanceof ApiError &&
        error.retryable &&
        error.code !== 'rate_limited' &&
        failureCount < 1,
      retryDelay: 800,
    },
  },
});
