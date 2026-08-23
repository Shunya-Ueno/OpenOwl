import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authGateway } from '../infrastructure/SupabaseAuthGateway';

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authGateway.signOut(),
    onSuccess: () => {
      // 前のユーザーのキャッシュが次のユーザーに見えるのを防ぐ
      // (docs/frontend-design.md 5.2)。RLS がある以上サーバーからは取れないが、
      // ローカルのキャッシュは別問題。
      queryClient.clear();
    },
  });
}
