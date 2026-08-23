import { router } from 'expo-router';
import { supabase } from '../supabase/client';
import { ApiError } from './ApiError';

export type UnauthorizedOutcome = 'not_unauthorized' | 'refreshed' | 'signed_out';

/**
 * docs/frontend-design.md 7 の unauthorized 行: refreshSession() を1回試み、
 * 失敗ならサインアウトして /sign-in へ。呼び出し元は 'not_unauthorized' の
 * ときだけ通常のエラー表示にフォールバックする。
 */
export async function handleUnauthorizedError(error: unknown): Promise<UnauthorizedOutcome> {
  if (!(error instanceof ApiError) || error.code !== 'unauthorized') {
    return 'not_unauthorized';
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (!refreshError) return 'refreshed';

  await supabase.auth.signOut();
  router.replace('/sign-in');
  return 'signed_out';
}
