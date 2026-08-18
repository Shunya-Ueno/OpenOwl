import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/lib/useAuth';
import { queryKeys } from '@/shared/lib/queryKeys';
import { searchHistoryRepository } from '../api/SearchHistoryRepository';

export function useSearchHistoryItem(id: string) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: queryKeys.searchHistoryItem(userId, id),
    queryFn: () => searchHistoryRepository.getById(id),
    enabled: user !== null,
  });
}
