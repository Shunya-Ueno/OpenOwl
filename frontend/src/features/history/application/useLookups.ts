import { useQuery } from '@tanstack/react-query';
import { lookupsApi } from '../infrastructure/LookupsApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useLookups() {
  return useQuery({
    queryKey: queryKeys.lookups(),
    queryFn: () => lookupsApi.listRecent(),
  });
}
