import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../src/shared/query/queryClient';
import { MobileFrame } from '../src/shared/ui/MobileFrame';
import { supabase } from '../src/shared/supabase/client';
import { useAuthStore } from '../src/features/auth/authStore';
import { registerServiceWorker, type ServiceWorkerUpdate } from '../src/shared/pwa/registerServiceWorker';
import { injectHeadTags } from '../src/shared/pwa/injectHeadTags';
import { colors, spacing, typography } from '../src/shared/theme/tokens';
import { testIds } from '../src/shared/testIds';

export default function RootLayout() {
  const setSession = useAuthStore((state) => state.setSession);
  const [update, setUpdate] = useState<ServiceWorkerUpdate | null>(null);

  // docs/frontend-design.md 5.2: セッションを書き込むのはアプリ全体で
  // この購読器 1 箇所だけ。
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, [setSession]);

  // docs/frontend-design.md 10.3: 新しいバージョンの通知。自動リロードはしない
  // (入力中の単語が消えるため)。
  useEffect(() => {
    registerServiceWorker(setUpdate);
  }, []);

  // web.output: "single" では app/+html.tsx が効かないため、実行時に注入する
  // (docs/frontend-design.md 10)。
  useEffect(() => {
    injectHeadTags();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <MobileFrame>
          <Stack screenOptions={{ headerShown: false }} />
          {update ? <UpdateBanner update={update} /> : null}
        </MobileFrame>
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function UpdateBanner({ update }: { readonly update: ServiceWorkerUpdate }) {
  return (
    <View
      style={styles.updateBanner}
      accessibilityLiveRegion="polite"
      testID={testIds.updateBanner.root}
    >
      <Text style={styles.updateText}>新しいバージョンがあります</Text>
      <Pressable
        onPress={update.activateAndReload}
        testID={testIds.updateBanner.action}
        accessibilityRole="button"
        accessibilityLabel="更新して再読み込み"
      >
        <Text style={styles.updateAction}>更新する</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  updateBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  updateText: {
    ...typography.body,
    color: colors.textInverse,
  },
  updateAction: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
