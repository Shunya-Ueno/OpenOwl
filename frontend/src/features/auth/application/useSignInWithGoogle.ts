import { useMutation } from '@tanstack/react-query';
import { signInWithGoogle } from '../infrastructure/GoogleAuthProvider';
import { authGateway } from '../infrastructure/SupabaseAuthGateway';

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async () => {
      const outcome = await signInWithGoogle();
      if (outcome.kind === 'session') {
        await authGateway.signInWithIdToken('google', outcome.idToken, outcome.nonce);
      }
      // 'redirecting'(Web) と 'cancelled'(ネイティブ)はここで完結する。
    },
  });
}
