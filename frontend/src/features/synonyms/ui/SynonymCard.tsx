import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme/tokens';
import type { Synonym } from '../domain/Synonym';
import { partOfSpeechLabel } from './partOfSpeechLabel';

interface SynonymCardProps {
  synonym: Synonym;
}

export function SynonymCard({ synonym }: SynonymCardProps) {
  const label = partOfSpeechLabel(synonym.partOfSpeech);

  return (
    <View style={styles.card} testID={`synonym-card-${synonym.sortOrder}`}>
      <View style={styles.headerRow}>
        <Text style={styles.term}>{synonym.term}</Text>
        {label ? <Text style={styles.partOfSpeech}>{label}</Text> : null}
      </View>
      <Text style={styles.definition}>{synonym.definition}</Text>
      <Text style={styles.nuance}>{synonym.nuance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  term: {
    ...typography.heading,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  partOfSpeech: {
    ...typography.caption,
    color: colors.primary,
  },
  definition: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  nuance: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
