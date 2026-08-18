import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { z } from 'zod';
import { Screen } from '@/shared/ui/Screen';
import { Button } from '@/shared/ui/Button';
import { Banner } from '@/shared/ui/Banner';
import { ApiError } from '@/shared/api/ApiError';
import { formatRetryAfter } from '@/shared/lib/formatDuration';
import { useNetworkStatus } from '@/shared/lib/useNetworkStatus';
import { colors, spacing, typography } from '@/shared/theme/tokens';
import { WordInput } from '../domain/WordInput';
import { useGenerateSynonyms } from '../hooks/useGenerateSynonyms';
import { WordInputField } from './WordInputField';
import { SynonymList } from './SynonymList';
import { UsageIndicator } from './UsageIndicator';

const formSchema = z.object({ word: WordInput.schema });
type FormValues = z.infer<typeof formSchema>;

const SLOW_HINT_DELAY_MS = 3000;

export function HomeScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { word: '' },
  });
  const mutation = useGenerateSynonyms();
  const { isOnline } = useNetworkStatus();
  const [showSlowHint, setShowSlowHint] = useState(false);

  // 「生成中です…」のヒントは setTimeout のコールバック内(非同期)で true にし、
  // リセットは送信のたびにイベントハンドラ側で行う。effect 本体で直接 setState すると
  // 連鎖的な再レンダーを招くため避ける(react-hooks/set-state-in-effect)。
  useEffect(() => {
    if (!mutation.isPending) return;
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [mutation.isPending]);

  const onSubmit = handleSubmit((values) => {
    setShowSlowHint(false);
    mutation.mutate(values.word);
  });

  const retry = () => {
    const current = getValues('word');
    if (!current) return;
    setShowSlowHint(false);
    mutation.mutate(current);
  };

  const errorMessage = describeError(mutation.error);

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>OpenOwl</Text>

        {!isOnline ? <Banner variant="warning" message="オフラインです。接続を確認してください。" /> : null}

        <Controller
          control={control}
          name="word"
          render={({ field }) => (
            <WordInputField
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.word?.message}
            />
          )}
        />

        <Button
          label="類義語を生成"
          onPress={onSubmit}
          loading={mutation.isPending}
          disabled={!isOnline}
          testID="home-generate-button"
        />

        {showSlowHint ? <Text style={styles.hint}>生成中です…</Text> : null}

        {errorMessage ? (
          <>
            <Banner variant="error" message={errorMessage} testID="home-error-banner" />
            <Button
              label="もう一度試す"
              variant="secondary"
              onPress={retry}
              testID="home-retry-button"
            />
            <Button
              label="履歴を見る"
              variant="secondary"
              onPress={() => router.push('/history')}
              testID="home-view-history-button"
            />
          </>
        ) : null}

        {mutation.data ? (
          <>
            <UsageIndicator
              dailyLimit={mutation.data.usage.dailyLimit}
              remainingToday={mutation.data.usage.remainingToday}
            />
            <SynonymList synonyms={mutation.data.synonyms} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * エラーコードで分岐せず、原則としてサーバ/クライアント検証が返す日本語をそのまま表示する
 * (docs/error-handling.md)。例外は rate_limited の待ち時間表示のみ。
 */
function describeError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.code === 'rate_limited' && error.retryAfterSeconds !== undefined) {
      return `${error.message}(${formatRetryAfter(error.retryAfterSeconds)})`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return '予期しないエラーが発生しました。もう一度お試しください。';
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
