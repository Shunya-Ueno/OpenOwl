import { router, Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { z } from 'zod';
import { Screen } from '@/shared/ui/Screen';
import { Button } from '@/shared/ui/Button';
import { Banner } from '@/shared/ui/Banner';
import { TextField } from '@/shared/ui/TextField';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useSignUp } from '../hooks/useSignUp';

// 8文字以上という要件は Supabase Auth 側の設定(backend/supabase/config.toml)と一致させる。
// クライアント側の検証は UX のためであり、強制力はサーバ側にある(docs/security.md)。
const schema = z.object({
  email: z.string().min(1, 'メールアドレスを入力してください。').email('メールアドレスの形式が正しくありません。'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください。'),
});
type FormValues = z.infer<typeof schema>;

export function SignUpScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const signUp = useSignUp();

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess: () => router.replace({ pathname: '/verify-email', params: { email: values.email } }),
    });
  });

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>新規登録</Text>

        {signUp.isError ? (
          <Banner
            variant="error"
            message={signUp.error instanceof Error ? signUp.error.message : 'エラーが発生しました。'}
            testID="sign-up-error-banner"
          />
        ) : null}

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              testID="sign-up-email-input"
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
              testID="sign-up-password-input"
              label="パスワード(8文字以上)"
              secureTextEntry
              // Android のパスワードマネージャには「新規パスワード」と伝える。
              autoComplete="new-password"
              // iOS では textContentType を明示的に上書きする。
              // autoComplete="new-password" は iOS で textContentType="newPassword" にマップされ、
              // Automatic Strong Password が起動して入力欄を黄色いカバービューで覆う。
              // その状態で自分のパスワードを打つにはキーボード上部の
              // 「Choose My Own Password」を押すしかなく、ソフトウェアキーボードが
              // 出ていない環境(シミュレータのハードウェアキーボード接続時など)では
              // 事実上入力不能になる。
              // Associated Domains を設定して Automatic Strong Password を
              // 正式にサポートするまでは "password" を使う(AutoFill の保存・補完は効く)。
              textContentType="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
            />
          )}
        />

        <Button
          label="登録する"
          onPress={onSubmit}
          loading={signUp.isPending}
          testID="sign-up-submit-button"
        />

        <Link href="/sign-in" style={styles.footerLink}>
          既にアカウントをお持ちの方はこちら
        </Link>
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
  footerLink: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
