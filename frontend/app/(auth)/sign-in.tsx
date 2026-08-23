import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { EmailPasswordForm, type EmailPasswordFormValues } from '../../src/features/auth/ui/EmailPasswordForm';
import { SocialSignInButtons } from '../../src/features/auth/ui/SocialSignInButtons';
import { useSignInWithPassword } from '../../src/features/auth/application/useSignInWithPassword';
import { useSignInWithGoogle } from '../../src/features/auth/application/useSignInWithGoogle';
import { useSignInWithApple } from '../../src/features/auth/application/useSignInWithApple';
import { getAuthErrorMessage } from '../../src/features/auth/authErrorMessage';
import { Banner } from '../../src/shared/ui/Banner';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';

export default function SignInScreen() {
  const signIn = useSignInWithPassword();
  const signInWithGoogle = useSignInWithGoogle();
  const signInWithApple = useSignInWithApple();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busy = signIn.isPending || signInWithGoogle.isPending || signInWithApple.isPending;

  const handleSubmit = (values: EmailPasswordFormValues) => {
    setErrorMessage(null);
    signIn.mutate(values, {
      onError: (error) => setErrorMessage(getAuthErrorMessage(error)),
    });
  };

  const handleGoogle = () => {
    setErrorMessage(null);
    signInWithGoogle.mutate(undefined, {
      onError: (error) => setErrorMessage(getAuthErrorMessage(error)),
    });
  };

  const handleApple = () => {
    setErrorMessage(null);
    signInWithApple.mutate(undefined, {
      onError: (error) => setErrorMessage(getAuthErrorMessage(error)),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        OpenOwl にログイン
      </Text>

      {errorMessage ? <Banner tone="danger" message={errorMessage} /> : null}

      <EmailPasswordForm
        mode="sign-in"
        submitLabel="ログイン"
        submitting={signIn.isPending}
        onSubmit={handleSubmit}
      />

      <Link href="/forgot-password" style={styles.link}>
        パスワードをお忘れですか？
      </Link>

      <View style={styles.divider} />

      <SocialSignInButtons
        onPressGoogle={handleGoogle}
        onPressApple={handleApple}
        googleLoading={signInWithGoogle.isPending}
        appleLoading={signInWithApple.isPending}
        disabled={busy}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>アカウントをお持ちでないですか？</Text>
        <Link href="/sign-up" style={styles.link}>
          新規登録
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
  link: {
    ...typography.body,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
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
});
