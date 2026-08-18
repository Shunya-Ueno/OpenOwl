/**
 * TanStack Query のクエリキーを1箇所に集約する。
 *
 * サーバ状態のキーには必ず userId を含める。アカウント切り替え時に
 * 前のユーザーのキャッシュが表示される事故を防ぐため
 * (docs/frontend/state-management.md)。
 */
export const queryKeys = {
  searchHistory: (userId: string) => ['search-history', userId] as const,
  searchHistoryItem: (id: string) => ['search-history', 'item', id] as const,
} as const;
