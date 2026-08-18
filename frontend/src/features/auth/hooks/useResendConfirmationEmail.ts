import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

export function useResendConfirmationEmail() {
  return useMutation({
    mutationFn: (email: string) => authClient.resendConfirmationEmail(email),
  });
}
