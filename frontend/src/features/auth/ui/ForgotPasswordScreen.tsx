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
import { useForgotPassword } from '../hooks/useForgotPassword';

const schema = z.object({
  email: z.string().min(1, 'メールアドレスを入力してください。').email('メールアドレスの形式が正しくありません。'),
});
type FormValues = z.infer<typeof schema>;

/**
 * MVP の機能スコープには明記がなかったが、パスワードを忘れたユーザーの
 * 復帰手段として screens.md で推奨した画面(オーナー確認済み)。
 */
export function ForgotPasswordScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);

  const onSubmit = handleSubmit((values) => {
    forgotPassword.mutate(values.email, { onSuccess: () => setSent(true) });
  });

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>パスワードの再設定</Text>
        <Text style={styles.body}>
          登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。
        </Text>

        {forgotPassword.isError ? (
          <Banner
            variant="error"
            message={forgotPassword.error instanceof Error ? forgotPassword.error.message : 'エラーが発生しました。'}
          />
        ) : null}
        {sent ? (
          <Banner variant="success" message="再設定用のメールを送信しました。メールをご確認ください。" />
        ) : null}

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              testID="forgot-password-email-input"
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

        <Button
          label="再設定メールを送る"
          onPress={onSubmit}
          loading={forgotPassword.isPending}
          disabled={sent}
          testID="forgot-password-submit-button"
        />

        <Link href="/sign-in" style={styles.link}>
          ログイン画面に戻る
        </Link>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
