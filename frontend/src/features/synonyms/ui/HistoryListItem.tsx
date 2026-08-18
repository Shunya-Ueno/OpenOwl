import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme/tokens';
import type { SearchHistoryEntry } from '../domain/SearchHistoryEntry';

interface HistoryListItemProps {
  entry: SearchHistoryEntry;
  onPress: () => void;
  /** 一覧内の位置。E2E から先頭の項目を掴むために使う(id は uuid で予測できないため)。 */
  index: number;
}

export function HistoryListItem({ entry, onPress, index }: HistoryListItemProps) {
  const preview = entry.generation?.synonyms.map((s) => s.term).join('、') ?? '';

  return (
    <Pressable
      onPress={onPress}
      testID={`history-item-${index}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.textColumn}>
        <Text style={styles.word}>{entry.rawInput}</Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
      <Text style={styles.date}>{formatDate(entry.createdAt)}</Text>
    </Pressable>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  textColumn: {
    flex: 1,
    marginRight: spacing.sm,
  },
  word: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  preview: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
