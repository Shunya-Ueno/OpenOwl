import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { router, Link } from 'expo-router';
import { EmailPasswordForm, type EmailPasswordFormValues } from '../../src/features/auth/ui/EmailPasswordForm';
import { useSignUpWithPassword } from '../../src/features/auth/application/useSignUpWithPassword';
import { getAuthErrorMessage } from '../../src/features/auth/authErrorMessage';
import { Banner } from '../../src/shared/ui/Banner';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';

export default function SignUpScreen() {
  const signUp = useSignUpWithPassword();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (values: EmailPasswordFormValues) => {
    setErrorMessage(null);
    signUp.mutate(values, {
      onSuccess: () => router.replace('/verify-email'),
      onError: (error) => setErrorMessage(getAuthErrorMessage(error)),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        新規登録
      </Text>

      {errorMessage ? <Banner tone="danger" message={errorMessage} /> : null}

      <EmailPasswordForm
        mode="sign-up"
        submitLabel="登録する"
        submitting={signUp.isPending}
        onSubmit={handleSubmit}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>既にアカウントをお持ちですか？</Text>
        <Link href="/sign-in" style={styles.link}>
          ログイン
        </Link>
      </View>
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
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: colors.textMuted,
  },
  link: {
    ...typography.body,
    color: colors.primary,
  },
});
