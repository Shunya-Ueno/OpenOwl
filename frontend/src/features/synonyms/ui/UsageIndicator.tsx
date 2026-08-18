import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/shared/theme/tokens';

interface UsageIndicatorProps {
  dailyLimit: number;
  remainingToday: number;
}

/** 残り回数を常時表示する。上限に達してから知るのではなく、減っていく様子を見せる。 */
export function UsageIndicator({ dailyLimit, remainingToday }: UsageIndicatorProps) {
  return (
    <Text style={styles.text} testID="home-usage-indicator">
      本日の残り: {remainingToday} / {dailyLimit}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
