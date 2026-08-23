import { Redirect, Stack } from 'expo-router';
import { useAuthStatus } from '../../src/features/auth/authStore';
import { Splash } from '../../src/shared/ui/Splash';

export default function AppLayout() {
  const status = useAuthStatus();

  if (status === 'loading') return <Splash />;
  if (status === 'unauthenticated') return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
