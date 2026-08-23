import type { PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, layout } from '../theme/tokens';

/**
 * UI はモバイル幅（〜480px）専用として設計する(ADR-0005)。
 * デスクトップで開かれた場合は、この固定幅コンテナで中央寄せ表示するだけに留める。
 * メディアクエリ・useWindowDimensions による大画面向け分岐はここにも他所にも作らない。
 */
export function MobileFrame({ children }: PropsWithChildren) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    backgroundColor: colors.background,
  },
});
