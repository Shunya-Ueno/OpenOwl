import { Alert, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/shared/ui/Screen';
import { Button } from '@/shared/ui/Button';
import { Banner } from '@/shared/ui/Banner';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useAuth } from '../hooks/AuthProvider';
import { useSignOut } from '../hooks/useSignOut';
import { useDeleteAccount } from '../hooks/useDeleteAccount';

export function AccountScreen() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();

  const confirmDelete = () => {
    Alert.alert(
      'アカウントを削除しますか?',
      'この操作は取り消せません。検索履歴を含むすべてのデータが削除されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除する', style: 'destructive', onPress: () => deleteAccount.mutate() },
      ],
    );
  };

  return (
    <Screen>
      <Text style={styles.title}>アカウント</Text>

      <View style={styles.section}>
        <Text style={styles.label}>メールアドレス</Text>
        <Text style={styles.value} testID="account-email">
          {user?.email ?? '-'}
        </Text>
      </View>

      {deleteAccount.isError ? (
        <Banner
          variant="error"
          message={
            deleteAccount.error instanceof Error ? deleteAccount.error.message : 'エラーが発生しました。'
          }
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          label="サインアウト"
          variant="secondary"
          onPress={() => signOut.mutate()}
          loading={signOut.isPending}
          testID="account-sign-out-button"
        />
        <Button
          label="アカウントを削除"
          variant="danger"
          onPress={confirmDelete}
          loading={deleteAccount.isPending}
          testID="account-delete-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
});
