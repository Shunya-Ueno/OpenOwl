import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/shared/ui/Screen';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useAuthCallback } from '../hooks/useAuthCallback';

/**
 * 認証メールのリンク(確認・パスワード再設定)から戻ってきたときの着地点。
 *
 * この画面と /reset-password は (auth) にも (app) にも属さないルートに置いている。
 * リンク処理でセッションが確立すると「認証済み」になるため、(auth) 配下に置くと
 * ガードによって (app) へ飛ばされ、新しいパスワードを入力できなくなるため。
 */
export function AuthCallbackScreen() {
  const { state, type, message } = useAuthCallback();

  useEffect(() => {
    if (state !== 'done') return;
    if (type === 'recovery') {
      router.replace('/reset-password');
    } else {
      // メール確認など。認証済みなので (app) のガードがそのまま通す。
      router.replace('/');
    }
  }, [state, type]);

  if (state === 'error') {
    return (
      <Screen>
        <Banner variant="error" message={message ?? 'リンクを処理できませんでした。'} />
        <Button label="ログイン画面へ" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.centered}>
        <Spinner size="large" />
        <Text style={styles.text}>確認しています…</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
