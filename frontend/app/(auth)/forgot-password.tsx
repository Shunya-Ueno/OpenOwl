import { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { TextField } from '../../src/shared/ui/TextField';
import { Button } from '../../src/shared/ui/Button';
import { Banner } from '../../src/shared/ui/Banner';
import { useForgotPassword } from '../../src/features/auth/application/useForgotPassword';
import { getAuthErrorMessage } from '../../src/features/auth/authErrorMessage';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('メールアドレスの形式を確認してください。');
      return;
    }
    setEmailError(null);
    setErrorMessage(null);

    forgotPassword.mutate(trimmed, {
      onSuccess: () => setSent(true),
      onError: (error) => setErrorMessage(getAuthErrorMessage(error)),
    });
  };

  if (sent) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          メールを送信しました
        </Text>
        <Text style={styles.body}>
          パスワード再設定用のリンクを記載したメールを送信しました。届いたメールをご確認ください。
        </Text>
        <Link href="/sign-in" style={styles.link}>
          ログインに戻る
        </Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        パスワードを再設定
      </Text>
      <Text style={styles.body}>登録済みのメールアドレスを入力してください。</Text>

      {errorMessage ? <Banner tone="danger" message={errorMessage} /> : null}

      <TextField
        label="メールアドレス"
        value={email}
        onChangeText={setEmail}
        errorMessage={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!forgotPassword.isPending}
      />
      <Button label="送信する" onPress={handleSubmit} loading={forgotPassword.isPending} />

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
