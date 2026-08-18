import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

export function useSignOut() {
  return useMutation({
    mutationFn: () => authClient.signOut(),
  });
}
