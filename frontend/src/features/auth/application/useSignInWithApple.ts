import { useMutation } from '@tanstack/react-query';
import { signInWithApple } from '../infrastructure/AppleAuthProvider';
import { authGateway } from '../infrastructure/SupabaseAuthGateway';
import { supabase } from '../../../shared/supabase/client';

export function useSignInWithApple() {
  return useMutation({
    mutationFn: async () => {
      const outcome = await signInWithApple();
      if (outcome.kind !== 'session') return;

      const session = await authGateway.signInWithIdToken('apple', outcome.idToken, outcome.nonce);

      // Apple は氏名を初回認可時にしか返さない。取れた場合はその場で書き込む
      // (docs/frontend-design.md 8.2)。取り逃すと復旧手段が手入力しかない。
      if (outcome.fullName) {
        await supabase
          .from('profiles')
          .update({ display_name: outcome.fullName })
          .eq('id', session.user.id);
      }
    },
  });
}
