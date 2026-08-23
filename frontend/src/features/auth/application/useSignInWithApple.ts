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
      // profiles.display_name の CHECK(1〜50文字)に合わせてトリムする。
      // これをしないと、長い氏名でサインイン自体は成功しているのに
      // エラーバナーが出てしまう(migration 20260822145729 が handle_new_user
      // 側で行っているのと同じ対策をクライアント側にも施す)。
      const displayName = outcome.fullName?.trim().slice(0, 50) || null;
      if (displayName) {
        await supabase.from('profiles').update({ display_name: displayName }).eq('id', session.user.id);
      }
    },
  });
}
