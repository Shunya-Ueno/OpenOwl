import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authClient.resetPasswordForEmail(email),
  });
}
