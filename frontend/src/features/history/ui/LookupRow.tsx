import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, layout } from '../../../shared/theme/tokens';
import { testIds } from '../../../shared/testIds';
import type { LookupSummary } from '../infrastructure/LookupsApi';

interface LookupRowProps {
  readonly lookup: LookupSummary;
  readonly onPress: () => void;
  readonly onDelete: () => void;
}

export function LookupRow({ lookup, onPress, onDelete }: LookupRowProps) {
  return (
    <View style={styles.row} testID={testIds.history.row}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${lookup.term.text} の類義語を見る`}
        style={styles.main}
      >
        <Text style={styles.word} testID={testIds.history.rowWord}>
          {lookup.term.text}
        </Text>
        <Text style={styles.date}>{formatDate(lookup.createdAt)}</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        testID={testIds.history.rowDelete}
        accessibilityRole="button"
        accessibilityLabel={`${lookup.term.text} を履歴から削除`}
        hitSlop={spacing.sm}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteLabel}>削除</Text>
      </Pressable>
    </View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTapTarget,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: 2,
  },
  word: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  deleteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.danger,
  },
});
