import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { authClient } from '../api/SupabaseAuthClient';
import type { AuthCallbackType } from '../api/SupabaseAuthClient';

type CallbackState = 'pending' | 'done' | 'error';

interface AuthCallbackHookResult {
  readonly state: CallbackState;
  readonly type: AuthCallbackType | null;
  readonly message: string | null;
}

/**
 * 認証メール(確認・パスワード再設定)のリンクから戻ってきた URL を処理し、
 * セッションを確立する。
 *
 * supabaseClient は detectSessionInUrl: false(ブラウザではないため)なので、
 * URL からのセッション確立は自前で行う必要がある。
 */
export function useAuthCallback(): AuthCallbackHookResult {
  const url = Linking.useLinkingURL();
  const [state, setState] = useState<CallbackState>('pending');
  const [type, setType] = useState<AuthCallbackType | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    authClient
      .establishSessionFromUrl(url)
      .then((result) => {
        if (cancelled) return;
        setType(result.type);
        if (result.session) {
          setState('done');
          return;
        }
        setState('error');
        setMessage('リンクを処理できませんでした。もう一度お試しください。');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'リンクの有効期限が切れています。もう一度お試しください。',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { state, type, message };
}
