import { useMutation } from '@tanstack/react-query';
import { authGateway } from '../infrastructure/SupabaseAuthGateway';

export function useSignUpWithPassword() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authGateway.signUpWithPassword(input.email, input.password),
  });
}
