import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../../shared/theme/tokens';
import { testIds } from '../../../shared/testIds';
import type { SynonymResult } from '../domain/SynonymResult';

interface GenerationStateBadgeProps {
  readonly generation: SynonymResult['generation'];
}

/**
 * 成功レスポンスでも UI を変える3ケース(docs/frontend-design.md 7.1)。
 * cached は既定では何も出さない(ユーザーには無関係な内部事情)。
 */
export function GenerationStateBadge({ generation }: GenerationStateBadgeProps) {
  if (generation.stale) {
    return (
      <View style={[styles.badge, styles.warning]} testID={testIds.result.stateBadge}>
        <Text style={[styles.text, styles.warningText]}>⚠ 最新ではない可能性があります</Text>
      </View>
    );
  }

  if (generation.id === null) {
    return (
      <View style={[styles.badge, styles.info]} testID={testIds.result.stateBadge}>
        <Text style={styles.text}>この結果は保存されていません</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  warning: {
    backgroundColor: colors.warningSurface,
  },
  info: {
    backgroundColor: colors.surface,
  },
  text: {
    ...typography.caption,
    color: colors.textMuted,
  },
  warningText: {
    color: colors.warningText,
  },
});
