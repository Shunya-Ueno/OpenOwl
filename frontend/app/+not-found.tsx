import { View, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { EmptyState } from '../src/shared/ui/EmptyState';
import { spacing } from '../src/shared/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <EmptyState title="ページが見つかりません" description="URL をご確認ください。" />
        <Link href="/" style={styles.link}>
          ホームに戻る
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  link: {
    marginTop: spacing.md,
  },
});
