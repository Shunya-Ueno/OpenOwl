import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { WordField } from '../../src/features/synonyms/ui/WordField';
import { GenerationErrorNotice } from '../../src/features/synonyms/ui/GenerationErrorNotice';
import { useGenerateSynonyms } from '../../src/features/synonyms/application/useGenerateSynonyms';
import { WordInput } from '../../src/features/synonyms/domain/WordInput';
import { useLookups } from '../../src/features/history/application/useLookups';
import { LookupRow } from '../../src/features/history/ui/LookupRow';
import { useDeleteLookup } from '../../src/features/history/application/useDeleteLookup';
import { EmptyState } from '../../src/shared/ui/EmptyState';
import { ApiError } from '../../src/shared/api/ApiError';
import { handleUnauthorizedError } from '../../src/shared/api/handleUnauthorizedError';
import { Banner } from '../../src/shared/ui/Banner';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';
import { testIds } from '../../src/shared/testIds';

const RECENT_HISTORY_COUNT = 5;

export default function HomeScreen() {
  const [word, setWord] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<ApiError | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const generate = useGenerateSynonyms();
  const lookups = useLookups();
  const deleteLookup = useDeleteLookup();

  const handleSubmit = () => {
    const validationError = WordInput.validationError(word);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    setInputError(null);
    setGenerationError(null);
    setNoticeMessage(null);

    generate.mutate(
      { word },
      {
        onSuccess: (result) => {
          setWord('');
          router.push({ pathname: '/synonyms/[word]', params: { word: result.term.text } });
        },
        onError: async (error) => {
          const outcome = await handleUnauthorizedError(error);
          if (outcome === 'refreshed') {
            setNoticeMessage('セッションを更新しました。もう一度お試しください。');
            return;
          }
          if (outcome === 'signed_out') return;

          setGenerationError(
            error instanceof ApiError
              ? error
              : new ApiError('internal_error', 'エラーが発生しました。もう一度お試しください。'),
          );
        },
      },
    );
  };

  const recentLookups = (lookups.data ?? []).slice(0, RECENT_HISTORY_COUNT);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header" testID={testIds.home.title}>
          OpenOwl
        </Text>
        <Link href="/settings" style={styles.headerLink}>
          設定
        </Link>
      </View>

      {noticeMessage ? (
        <Banner tone="info" message={noticeMessage} testID={testIds.home.notice} />
      ) : null}

      <WordField
        value={word}
        onChangeText={(text) => {
          setWord(text);
          if (inputError) setInputError(null);
        }}
        onSubmit={handleSubmit}
        submitting={generate.isPending}
        errorMessage={inputError}
      />

      {generationError ? (
        <GenerationErrorNotice error={generationError} onRetry={handleSubmit} />
      ) : null}

      <View style={styles.historySection}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>最近の履歴</Text>
          <Link href="/history" style={styles.headerLink}>
            すべて見る
          </Link>
        </View>

        {recentLookups.length === 0 ? (
          <EmptyState
            testID={testIds.home.historyEmpty}
            title="まだ履歴がありません"
            description="単語を入力して類義語を生成してみましょう。"
          />
        ) : (
          recentLookups.map((lookup) => (
            <LookupRow
              key={lookup.id}
              lookup={lookup}
              onPress={() =>
                router.push({ pathname: '/synonyms/[word]', params: { word: lookup.term.text } })
              }
              onDelete={() => deleteLookup.mutate(lookup.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  headerLink: {
    ...typography.body,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  historySection: {
    gap: spacing.sm,
  },
});
