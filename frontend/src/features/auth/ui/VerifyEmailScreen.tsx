import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/shared/ui/Screen';
import { Button } from '@/shared/ui/Button';
import { Banner } from '@/shared/ui/Banner';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useResendConfirmationEmail } from '../hooks/useResendConfirmationEmail';

const RESEND_COOLDOWN_SECONDS = 60;

interface VerifyEmailScreenProps {
  email: string;
}

export function VerifyEmailScreen({ email }: VerifyEmailScreenProps) {
  const resend = useResendConfirmationEmail();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // email が渡ってこないケース(直接この画面に来た等)では再送のしようがない。
  // 空文字で送るとサーバ側の汎用エラーになるだけなので、ボタン自体を無効化する。
  const canResend = email.length > 0;

  const handleResend = () => {
    if (!canResend) return;
    resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS) });
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>確認メールを送信しました</Text>
        <Text style={styles.body}>
          {email ? `${email} 宛に` : ''}
          確認メールをお送りしました。メール内のリンクからログインを完了してください。
        </Text>

        {!canResend ? (
          <Banner
            variant="info"
            message="再送するには、ログイン画面からもう一度登録操作を行ってください。"
          />
        ) : null}

        {resend.isError ? (
          <Banner
            variant="error"
            message={resend.error instanceof Error ? resend.error.message : 'エラーが発生しました。'}
          />
        ) : null}
        {resend.isSuccess && cooldown > 0 ? (
          <Banner variant="success" message="確認メールを再送しました。" />
        ) : null}

        <Button
          label={cooldown > 0 ? `再送する(${cooldown}秒後)` : '確認メールを再送する'}
          variant="secondary"
          onPress={handleResend}
          loading={resend.isPending}
          disabled={cooldown > 0 || !canResend}
          testID="verify-email-resend-button"
        />

        <Link href="/sign-in" style={styles.link}>
          ログイン画面に戻る
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
