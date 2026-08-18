import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/shared/ui/Screen';
import { Banner } from '@/shared/ui/Banner';
import { Spinner } from '@/shared/ui/Spinner';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { HistoryListItem } from './HistoryListItem';
import type { SearchHistoryEntry } from '../domain/SearchHistoryEntry';

// 見出しはネイティブヘッダー(app/(app)/history/_layout.tsx の title)が表示するため、
// この画面自身では重複させない。
export function HistoryListScreen() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useSearchHistory();

  const entries: SearchHistoryEntry[] = data?.pages.flat() ?? [];

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
          message={error instanceof Error ? error.message : '履歴の取得に失敗しました。'}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        testID="history-list"
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.listContainer}
        renderItem={({ item }) => (
          <HistoryListItem entry={item} onPress={() => router.push(`/history/${item.id}`)} />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>まだ検索していません</Text>
          </View>
        }
        ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
