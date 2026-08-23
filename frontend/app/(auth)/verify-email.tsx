import { ScrollView, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';

/**
 * docs/frontend-design.md 8.3: 設計上はメール確認を有効にする前提。
 * サインアップ後はここへ遷移する。
 */
export default function VerifyEmailScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        確認メールを送信しました
      </Text>
      <Text style={styles.body}>
        登録いただいたメールアドレスに確認メールを送信しました。メール内のリンクを開いて登録を完了してください。
      </Text>
      <Link href="/sign-in" style={styles.link}>
        ログインに戻る
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  link: {
    ...typography.body,
    color: colors.primary,
  },
});
