import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Splash } from '../../src/shared/ui/Splash';
import { authGateway } from '../../src/features/auth/infrastructure/SupabaseAuthGateway';
import { useAuthStatus } from '../../src/features/auth/authStore';

const FALLBACK_TIMEOUT_MS = 10_000;

/**
 * docs/frontend-design.md 3・8.2 の PKCE 分岐を吸収する唯一の場所。
 * - Web: detectSessionInUrl: true により supabase-js が自動処理する。
 *   ここでは status の変化を待つだけ。
 * - ネイティブ: detectSessionInUrl: false のため、code を自分で交換する。
 */
export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const status = useAuthStatus();
  const [failed, setFailed] = useState(false);
  const exchanged = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!code || exchanged.current) return;
    exchanged.current = true;

    authGateway.exchangeCodeForSession(code).catch(() => setFailed(true));
  }, [code]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status]);

  useEffect(() => {
    if (failed) {
      router.replace('/sign-in');
    }
  }, [failed]);

  // ログインリンクが無効・期限切れの場合に Splash に張り付いたままにしない。
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status !== 'authenticated') setFailed(true);
    }, FALLBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return <Splash />;
}
