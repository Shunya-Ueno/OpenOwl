import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useLookups } from '../../src/features/history/application/useLookups';
import { useDeleteLookup } from '../../src/features/history/application/useDeleteLookup';
import { LookupRow } from '../../src/features/history/ui/LookupRow';
import { EmptyState } from '../../src/shared/ui/EmptyState';
import { Splash } from '../../src/shared/ui/Splash';
import { Banner } from '../../src/shared/ui/Banner';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';

export default function HistoryScreen() {
  const lookups = useLookups();
  const deleteLookup = useDeleteLookup();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="戻る">
          <Text style={styles.back}>← 戻る</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          履歴
        </Text>
      </View>

      {lookups.isLoading ? <Splash /> : null}

      {lookups.isError ? (
        <Banner tone="danger" message="履歴を取得できませんでした。もう一度お試しください。" />
      ) : null}

      {lookups.data && lookups.data.length === 0 ? (
        <EmptyState title="まだ履歴がありません" description="単語を入力して類義語を生成してみましょう。" />
      ) : null}

      {lookups.data?.map((lookup) => (
        <LookupRow
          key={lookup.id}
          lookup={lookup}
          onPress={() => router.push({ pathname: '/synonyms/[word]', params: { word: lookup.term.text } })}
          onDelete={() => deleteLookup.mutate(lookup.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  headerRow: {
    gap: spacing.sm,
  },
  back: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
