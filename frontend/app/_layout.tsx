import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { queryClient } from '@/shared/lib/queryClient';
import { setupNetworkStatusListener } from '@/shared/lib/useNetworkStatus';
import { AuthProvider, useAuth } from '@/features/auth/hooks/AuthProvider';
import { authClient } from '@/features/auth/api/SupabaseAuthClient';

// セッション復元中にサインイン画面が一瞬見えてからホームに飛ぶチラつきを防ぐため、
// 認証状態が確定するまでネイティブスプラッシュを維持する(docs/frontend/state-management.md)。
SplashScreen.preventAutoHideAsync().catch(() => {
  // Fast Refresh 等で既に呼ばれている場合は無視してよい。
});

/**
 * 合成ルート。Provider の組み立てはここでのみ行う(DIコンテナは使わない。
 * backend の合成ルートと同じ方針。docs/backend-design.md)。
 */
export default function RootLayout() {
  useEffect(() => {
    authClient.configureGoogleSignIn();
    setupNetworkStatusListener();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'initializing') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  if (status === 'initializing') {
    // ネイティブスプラッシュが表示され続けているため、ここでは何も描画しない。
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      {/*
        認証メールのリンク着地点と、新しいパスワードの入力画面。
        リンク処理でセッションが確立すると「認証済み」になるため (auth) 配下には置けない
        (ガードで (app) へ飛ばされ、パスワードを入力できなくなる)。
      */}
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
