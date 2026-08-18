import { Pressable, StyleSheet, Text } from 'react-native';
import { Spinner } from './Spinner';
import { colors, radius, spacing, typography } from '@/shared/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

/**
 * 送信中(loading)は自動的に disabled 扱いにする。
 * 二重送信=二重課金の防止は呼び出し側任せにせず、ここで保証する
 * (docs/frontend/state-management.md)。
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        isDisabled && styles.disabledContainer,
        pressed && !isDisabled && variantStyles[variant].pressed,
      ]}
    >
      {loading ? (
        <Spinner color={variant === 'secondary' ? colors.primary : colors.textInverse} />
      ) : (
        <Text style={[styles.label, variantStyles[variant].label]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    ...typography.bodyStrong,
  },
  disabledContainer: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
});

const variantStyles = {
  primary: StyleSheet.create({
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    label: { color: colors.textInverse },
  }),
  secondary: StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { backgroundColor: colors.surface },
    label: { color: colors.primary },
  }),
  danger: StyleSheet.create({
    container: { backgroundColor: colors.danger },
    pressed: { backgroundColor: colors.danger },
    label: { color: colors.textInverse },
  }),
};
