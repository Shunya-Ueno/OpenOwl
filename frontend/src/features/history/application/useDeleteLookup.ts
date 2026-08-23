import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lookupsApi } from '../infrastructure/LookupsApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useDeleteLookup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lookupId: string) => lookupsApi.delete(lookupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups() });
    },
  });
}
