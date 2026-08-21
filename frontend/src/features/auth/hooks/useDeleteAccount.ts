import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => authClient.deleteAccount(),
  });
}
