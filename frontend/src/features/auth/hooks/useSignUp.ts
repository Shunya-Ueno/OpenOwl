import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

interface SignUpInput {
  email: string;
  password: string;
}

export function useSignUp() {
  return useMutation({
    mutationFn: ({ email, password }: SignUpInput) => authClient.signUpWithEmail(email, password),
  });
}
