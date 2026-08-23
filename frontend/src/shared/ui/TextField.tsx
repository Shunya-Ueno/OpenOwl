import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography, layout } from '../theme/tokens';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly errorMessage?: string | null;
}

export function TextField({ label, errorMessage, ...inputProps }: TextFieldProps) {
  const hasError = Boolean(errorMessage);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, hasError && styles.inputError]}
      />
      {hasError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  input: {
    minHeight: layout.minTapTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    ...typography.input,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
