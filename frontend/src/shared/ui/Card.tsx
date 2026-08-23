import type { PropsWithChildren } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';

interface CardProps extends PropsWithChildren {
  readonly style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
