import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/lib/queryKeys';
import { searchHistoryRepository } from '../api/SearchHistoryRepository';

export function useSearchHistoryItem(id: string) {
  return useQuery({
    queryKey: queryKeys.searchHistoryItem(id),
    queryFn: () => searchHistoryRepository.getById(id),
  });
}
