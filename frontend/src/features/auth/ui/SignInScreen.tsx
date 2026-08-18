import { useState } from 'react';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { z } from 'zod';
import { Screen } from '@/shared/ui/Screen';
import { Button } from '@/shared/ui/Button';
import { Banner } from '@/shared/ui/Banner';
import { TextField } from '@/shared/ui/TextField';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useSignIn } from '../hooks/useSignIn';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useSocialSignIn';
import { SocialSignInButtons } from './SocialSignInButtons';

const schema = z.object({
  email: z.string().min(1, 'メールアドレスを入力してください。').email('メールアドレスの形式が正しくありません。'),
  password: z.string().min(1, 'パスワードを入力してください。'),
});
type FormValues = z.infer<typeof schema>;

export function SignInScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const signIn = useSignIn();
  const googleSignIn = useGoogleSignIn();
  const appleSignIn = useAppleSignIn();
  const [socialError, setSocialError] = useState<string | null>(null);

  const isBusy = signIn.isPending || googleSignIn.isPending || appleSignIn.isPending;

  const onSubmit = handleSubmit((values) => {
    setSocialError(null);
    signIn.mutate(values);
  });

  const handleGoogle = () => {
    setSocialError(null);
    googleSignIn.mutate(undefined, {
      onError: (error) => setSocialError(describeError(error)),
    });
  };

  const handleApple = () => {
    setSocialError(null);
    appleSignIn.mutate(undefined, {
      onError: (error) => setSocialError(describeError(error)),
    });
  };

  const errorMessage = socialError ?? (signIn.error ? describeError(signIn.error) : null);

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>ログイン</Text>

        {errorMessage ? <Banner variant="error" message={errorMessage} testID="sign-in-error-banner" /> : null}

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              testID="sign-in-email-input"
              label="メールアドレス"
              keyboardType="email-address"
              autoComplete="email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              testID="sign-in-password-input"
              label="パスワード"
              secureTextEntry
              autoComplete="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
            />
          )}
        />

        <Link href="/forgot-password" style={styles.link}>
          パスワードをお忘れですか?
        </Link>

        <Button
          label="ログイン"
          onPress={onSubmit}
          loading={signIn.isPending}
          disabled={isBusy}
          testID="sign-in-submit-button"
        />

        <SocialSignInButtons
          onGooglePress={handleGoogle}
          onApplePress={handleApple}
          googleLoading={googleSignIn.isPending}
          appleLoading={appleSignIn.isPending}
          disabled={isBusy}
        />

        <Link href="/sign-up" style={styles.footerLink}>
          新規登録はこちら
        </Link>
      </ScrollView>
    </Screen>
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'エラーが発生しました。もう一度お試しください。';
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  footerLink: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
