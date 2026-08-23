import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextField } from '../../../shared/ui/TextField';
import { Button } from '../../../shared/ui/Button';
import { spacing } from '../../../shared/theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface EmailPasswordFormValues {
  readonly email: string;
  readonly password: string;
}

interface EmailPasswordFormProps {
  readonly mode: 'sign-in' | 'sign-up';
  readonly submitLabel: string;
  readonly submitting: boolean;
  readonly onSubmit: (values: EmailPasswordFormValues) => void;
}

export function EmailPasswordForm({ mode, submitLabel, submitting, onSubmit }: EmailPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedEmail = email.trim();
    const nextEmailError = EMAIL_PATTERN.test(trimmedEmail)
      ? null
      : 'メールアドレスの形式を確認してください。';
    const nextPasswordError =
      mode === 'sign-up' && password.length < MIN_PASSWORD_LENGTH
        ? `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`
        : password.length === 0
          ? 'パスワードを入力してください。'
          : null;

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) return;
    onSubmit({ email: trimmedEmail, password });
  };

  return (
    <View style={styles.container}>
      <TextField
        label="メールアドレス"
        value={email}
        onChangeText={setEmail}
        errorMessage={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!submitting}
      />
      <TextField
        label="パスワード"
        value={password}
        onChangeText={setPassword}
        errorMessage={passwordError}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
        editable={!submitting}
      />
      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
