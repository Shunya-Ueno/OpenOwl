import { Pressable, Text, StyleSheet, ActivityIndicator, type GestureResponderEvent } from 'react-native';
import { colors, radius, spacing, typography, layout } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  readonly label: string;
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly variant?: Variant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.textInverse} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'secondary' ? styles.labelSecondary : styles.labelOnFill,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTapTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  label: {
    ...typography.bodyStrong,
  },
  labelOnFill: {
    color: colors.textInverse,
  },
  labelSecondary: {
    color: colors.primary,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  danger: { backgroundColor: colors.danger },
});
