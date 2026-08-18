import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/AuthProvider';

/**
 * 認証済みなら (app) へリダイレクトする。この判断を持つのは
 * (auth)/_layout.tsx と (app)/_layout.tsx の2ファイルだけ(docs/frontend/state-management.md)。
 */
export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
