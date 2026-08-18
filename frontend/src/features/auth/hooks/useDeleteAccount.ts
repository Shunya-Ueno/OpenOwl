import { useMutation } from '@tanstack/react-query';
import { authClient } from '../api/SupabaseAuthClient';

/**
 * 注意: 対応する `delete-account` Edge Function はまだバックエンドに実装されていない。
 * 呼び出すと 404 になる。バックエンド側の追加実装(Phase 3 の追加スコープ)が
 * 完了してから使えるようになる(docs/frontend/screens.md)。
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => authClient.deleteAccount(),
  });
}
