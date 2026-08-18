import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

export function useGoogleSignIn() {
  return useMutation({
    mutationFn: () => authClient.signInWithGoogle(),
  });
}

export function useAppleSignIn() {
  return useMutation({
    mutationFn: () => authClient.signInWithApple(),
  });
}
