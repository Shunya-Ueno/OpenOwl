import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { z } from 'zod';
import { Screen } from '@/shared/ui/Screen';
import { Button } from '@/shared/ui/Button';
import { Banner } from '@/shared/ui/Banner';
import { TextField } from '@/shared/ui/TextField';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useUpdatePassword } from '../hooks/useUpdatePassword';

// 8文字以上という要件は Supabase Auth 側の設定と一致させる(docs/security.md)。
const schema = z
  .object({
    password: z.string().min(8, 'パスワードは8文字以上で入力してください。'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'パスワードが一致しません。',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

/**
 * パスワード再設定リンクから復帰した直後に、新しいパスワードを設定する画面。
 * この時点では既にセッションが確立しているため updateUser で変更できる。
 */
export function ResetPasswordScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const updatePassword = useUpdatePassword();

  const onSubmit = handleSubmit((values) => {
    updatePassword.mutate(values.password, {
      onSuccess: () => router.replace('/'),
    });
  });

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>新しいパスワードの設定</Text>

        {updatePassword.isError ? (
          <Banner
            variant="error"
            message={
              updatePassword.error instanceof Error
                ? updatePassword.error.message
                : 'エラーが発生しました。'
            }
          />
        ) : null}

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              testID="reset-password-input"
              label="新しいパスワード(8文字以上)"
              secureTextEntry
              autoComplete="new-password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <TextField
              testID="reset-password-confirm-input"
              label="新しいパスワード(確認)"
              secureTextEntry
              autoComplete="new-password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <Button
          label="パスワードを変更する"
          onPress={onSubmit}
          loading={updatePassword.isPending}
          testID="reset-password-submit-button"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
});
