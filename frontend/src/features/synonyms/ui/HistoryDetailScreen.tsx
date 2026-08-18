import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/shared/ui/Screen';
import { Banner } from '@/shared/ui/Banner';
import { Spinner } from '@/shared/ui/Spinner';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useSearchHistoryItem } from '../hooks/useSearchHistoryItem';
import { SynonymList } from './SynonymList';

interface HistoryDetailScreenProps {
  id: string;
}

export function HistoryDetailScreen({ id }: HistoryDetailScreenProps) {
  const { data: entry, isLoading, isError, error } = useSearchHistoryItem(id);

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Spinner size="large" />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <Banner
          variant="error"
          message={error instanceof Error ? error.message : '取得に失敗しました。'}
        />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen>
        <Banner variant="info" message="この履歴は見つかりませんでした。" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title} testID="history-detail-word">
        {entry.word.text}
      </Text>
      {entry.generation ? (
        <SynonymList synonyms={entry.generation.synonyms} />
      ) : (
        <Banner variant="info" message="この検索の結果は利用できません。" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
