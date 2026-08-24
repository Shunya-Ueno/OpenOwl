import { QueryClient } from '@tanstack/react-query';

/**
 * docs/frontend-design.md 5.6 の既定値。
 * mutation の retry は false にする — 生成の自動再試行は課金に直結するため
 * (ADR-0012)。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
