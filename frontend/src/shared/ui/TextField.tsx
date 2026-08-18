import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme/tokens';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/**
 * react-hook-form の Controller と組み合わせて使う想定
 * (RN の TextInput は register() が想定する DOM input と形が違うため)。
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, style, ...inputProps }, ref) => {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          style={[styles.input, error && styles.inputError, style]}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          {...inputProps}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);
TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
