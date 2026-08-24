import { Redirect, Stack } from 'expo-router';
import { useAuthStatus } from '../../src/features/auth/authStore';
import { Splash } from '../../src/shared/ui/Splash';

/**
 * docs/frontend-design.md 3.1: status === 'loading' の間に Redirect を返さない。
 * セッション復元前にリダイレクトすると、リロードのたびにログイン画面が一瞬見える。
 */
export default function AuthLayout() {
  const status = useAuthStatus();

  if (status === 'loading') return <Splash />;
  if (status === 'authenticated') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
