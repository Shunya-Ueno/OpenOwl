import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (newPassword: string) => authClient.updatePassword(newPassword),
  });
}
