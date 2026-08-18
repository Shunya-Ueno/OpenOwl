import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme/tokens';

type BannerVariant = 'error' | 'warning' | 'info' | 'success';

interface BannerProps {
  message: string;
  variant?: BannerVariant;
  testID?: string;
}

/**
 * エラー・警告・オフライン等の状態表示に使う共通バナー。
 * 文言はサーバ(api-spec.md)またはクライアントの検証ルールが渡す日本語をそのまま表示する
 * (docs/error-handling.md: 技術用語を出さない)。
 */
export function Banner({ message, variant = 'info', testID }: BannerProps) {
  return (
    <View style={[styles.container, variantStyles[variant]]} testID={testID}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.textPrimary,
  },
});

const variantStyles = StyleSheet.create({
  error: { backgroundColor: colors.dangerSurface },
  warning: { backgroundColor: colors.warningSurface },
  info: { backgroundColor: colors.surface },
  success: { backgroundColor: colors.successSurface },
});
