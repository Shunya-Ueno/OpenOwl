import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/AuthProvider';

/**
 * 未認証なら (auth) へリダイレクトする(docs/frontend/state-management.md)。
 * ボトムタブ: ホーム / 履歴 / アカウント(docs/frontend/screens.md)。
 */
export default function AppLayout() {
  const { status } = useAuth();

  if (status === 'unauthenticated') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="history" options={{ title: '履歴' }} />
      <Tabs.Screen name="account" options={{ title: 'アカウント' }} />
    </Tabs>
  );
}
