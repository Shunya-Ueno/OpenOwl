import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../../../shared/ui/Card';
import { colors, spacing, typography } from '../../../shared/theme/tokens';
import { testIds } from '../../../shared/testIds';
import type { SynonymItem } from '../domain/SynonymResult';

const PART_OF_SPEECH_LABEL: Record<NonNullable<SynonymItem['partOfSpeech']>, string> = {
  noun: '名詞',
  verb: '動詞',
  adjective: '形容詞',
  adverb: '副詞',
  other: 'その他',
};

const REGISTER_LABEL: Record<NonNullable<SynonymItem['register']>, string> = {
  formal: 'フォーマル',
  neutral: 'ニュートラル',
  informal: 'カジュアル',
};

interface SynonymCardProps {
  readonly item: SynonymItem;
}

export function SynonymCard({ item }: SynonymCardProps) {
  const tags = [
    item.partOfSpeech ? PART_OF_SPEECH_LABEL[item.partOfSpeech] : null,
    item.register ? REGISTER_LABEL[item.register] : null,
  ].filter((tag): tag is string => tag !== null);

  return (
    <Card testID={testIds.result.card}>
      <View style={styles.header}>
        <Text style={styles.word} accessibilityRole="header">
          {item.text}
        </Text>
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {item.nuance ? <Text style={styles.nuance}>{item.nuance}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  word: {
    ...typography.heading,
    color: colors.text,
  },
  tags: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tag: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  nuance: {
    ...typography.body,
    color: colors.textMuted,
  },
});
