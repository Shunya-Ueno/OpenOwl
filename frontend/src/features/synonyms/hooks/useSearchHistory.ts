import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/lib/useAuth';
import { queryKeys } from '@/shared/lib/queryKeys';
import { searchHistoryRepository } from '../api/SearchHistoryRepository';

const PAGE_SIZE = 20;

/** 検索履歴の一覧。副作用がなく再フェッチしても安全なため useQuery(系)を使う。 */
export function useSearchHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery({
    queryKey: queryKeys.searchHistory(userId),
    queryFn: ({ pageParam }) => searchHistoryRepository.list(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
    enabled: user !== null,
  });
}
