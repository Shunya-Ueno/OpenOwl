import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

interface SignInInput {
  email: string;
  password: string;
}

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: SignInInput) => authClient.signInWithEmail(email, password),
  });
}
