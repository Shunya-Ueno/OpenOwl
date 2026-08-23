import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useStoredSynonyms } from '../../../src/features/synonyms/application/useStoredSynonyms';
import { useGenerateSynonyms } from '../../../src/features/synonyms/application/useGenerateSynonyms';
import { SynonymCard } from '../../../src/features/synonyms/ui/SynonymCard';
import { GenerationStateBadge } from '../../../src/features/synonyms/ui/GenerationStateBadge';
import { GenerationErrorNotice } from '../../../src/features/synonyms/ui/GenerationErrorNotice';
import { Button } from '../../../src/shared/ui/Button';
import { Banner } from '../../../src/shared/ui/Banner';
import { Splash } from '../../../src/shared/ui/Splash';
import { EmptyState } from '../../../src/shared/ui/EmptyState';
import { ApiError } from '../../../src/shared/api/ApiError';
import { handleUnauthorizedError } from '../../../src/shared/api/handleUnauthorizedError';
import { colors, spacing, typography } from '../../../src/shared/theme/tokens';

/**
 * ADR-0012: URL 直接アクセス・リロード・履歴タップでは自動生成しない。
 * 保存済みの結果を読み、無ければ明示的なボタンで生成する。
 */
export default function SynonymResultScreen() {
  const { word } = useLocalSearchParams<{ word: string }>();
  const stored = useStoredSynonyms(word ?? '');
  const generate = useGenerateSynonyms();

  const [generationError, setGenerationError] = useState<ApiError | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const handleGenerate = (forceRefresh: boolean) => {
    if (!word) return;
    setGenerationError(null);
    setNoticeMessage(null);

    generate.mutate(
      { word, forceRefresh },
      {
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

  const result = generate.data ?? stored.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="戻る">
        <Text style={styles.back}>← 戻る</Text>
      </Pressable>

      <Text style={styles.title} accessibilityRole="header">
        {word}
      </Text>

      {noticeMessage ? <Banner tone="info" message={noticeMessage} /> : null}

      {stored.isLoading && !result ? <Splash /> : null}

      {generationError ? (
        <GenerationErrorNotice error={generationError} onRetry={() => handleGenerate(false)} />
      ) : null}

      {!stored.isLoading && !result && !generationError ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            title="まだ生成されていません"
            description="この単語の類義語をまだ生成していません。"
          />
          <Button label="この単語を生成する" onPress={() => handleGenerate(false)} loading={generate.isPending} />
        </View>
      ) : null}

      {result ? (
        <View style={styles.resultSection}>
          <GenerationStateBadge generation={result.generation} />
          {result.synonyms.length === 0 ? (
            <EmptyState
              title="類義語が見つかりませんでした"
              description="スペルをご確認のうえ、もう一度お試しください。"
            />
          ) : (
            result.synonyms.map((item, index) => <SynonymCard key={`${item.text}-${index}`} item={item} />)
          )}
          <Button
            label="別の候補を見る"
            variant="secondary"
            onPress={() => handleGenerate(true)}
            loading={generate.isPending}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  back: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  emptyContainer: {
    gap: spacing.lg,
  },
  resultSection: {
    gap: spacing.md,
  },
});
