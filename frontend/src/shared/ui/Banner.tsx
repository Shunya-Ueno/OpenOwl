import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Tone = 'info' | 'warning' | 'danger';

interface BannerProps {
  readonly tone: Tone;
  readonly message: string;
}

/**
 * 画面上部に出す一時的な通知。色だけで状態を表さない
 * (docs/frontend-design.md 11.3: 色だけで状態を表さない)。
 */
export function Banner({ tone, message }: BannerProps) {
  return (
    <View style={[styles.base, toneStyles[tone]]} accessibilityLiveRegion="polite">
      <Text style={styles.icon}>{toneIcon[tone]}</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const toneIcon: Record<Tone, string> = {
  info: 'ⓘ',
  warning: '⚠',
  danger: '✕',
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  icon: {
    ...typography.body,
  },
  text: {
    ...typography.body,
    flex: 1,
  },
});

const toneStyles = StyleSheet.create({
  info: { backgroundColor: colors.surface },
  warning: { backgroundColor: colors.warningSurface },
  danger: { backgroundColor: colors.dangerSurface },
});
