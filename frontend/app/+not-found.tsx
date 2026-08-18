import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/shared/ui/Screen';
import { colors, spacing, typography } from '@/shared/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'ページが見つかりません' }} />
      <Screen>
        <Text style={styles.title}>このページは存在しません。</Text>
        <Link href="/" style={styles.link}>
          ホームに戻る
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  link: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
  },
});
