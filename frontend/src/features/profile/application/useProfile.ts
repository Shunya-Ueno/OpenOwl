import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../infrastructure/ProfileApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileApi.get(),
  });
}

export function useUpdateDisplayName(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (displayName: string | null) => profileApi.updateDisplayName(userId, displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}
