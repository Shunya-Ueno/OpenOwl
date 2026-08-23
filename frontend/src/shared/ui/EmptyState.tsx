import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.textMuted,
    textAlign: 'center',
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
