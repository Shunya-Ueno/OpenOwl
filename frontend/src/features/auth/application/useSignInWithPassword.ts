import { useMutation } from '@tanstack/react-query';
import { authGateway } from '../infrastructure/SupabaseAuthGateway';

/**
 * セッションの更新は authStore の onAuthStateChange 購読(app/_layout.tsx)が
 * 一元的に行う。ここでは呼び出しのみ(docs/frontend-design.md 5.2)。
 */
export function useSignInWithPassword() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authGateway.signInWithPassword(input.email, input.password),
  });
}
