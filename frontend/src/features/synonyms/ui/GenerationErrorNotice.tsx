import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '../../../shared/ui/Card';
import { Banner } from '../../../shared/ui/Banner';
import { Button } from '../../../shared/ui/Button';
import { spacing } from '../../../shared/theme/tokens';
import { testIds } from '../../../shared/testIds';
import { ApiError } from '../../../shared/api/ApiError';

interface GenerationErrorNoticeProps {
  readonly error: ApiError;
  readonly onRetry: () => void;
}

/**
 * docs/frontend-design.md 7 のコード別方針。message はサーバーが返した日本語を
 * そのまま表示し、クライアントで文言を持たない。invalid_request は入力欄側で
 * 扱うため、unauthorized は画面側でリダイレクト処理するため、ここには通常来ない
 * が、防御的にどちらもカードとして表示できるようにしておく。
 */
export function GenerationErrorNotice({ error, onRetry }: GenerationErrorNoticeProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(error.retryAfterSeconds ?? 0);

  useEffect(() => {
    setRemainingSeconds(error.retryAfterSeconds ?? 0);
  }, [error]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = setTimeout(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => clearTimeout(timer);
  }, [remainingSeconds]);

  const isCountingDown = error.code === 'rate_limited' && remainingSeconds > 0;

  return (
    <Card testID={testIds.generationError.root}>
      <Banner tone={error.code === 'invalid_request' ? 'warning' : 'danger'} message={error.userMessage} />
      {error.code === 'rate_limited' ? (
        <Banner tone="info" message="保存済みの履歴はいつでも見返せます。" />
      ) : null}
      <View style={styles.actions}>
        <Button
          testID={testIds.generationError.retry}
          label={isCountingDown ? `${remainingSeconds}秒後に再試行できます` : '再試行'}
          onPress={onRetry}
          disabled={isCountingDown}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: spacing.xs,
  },
});
