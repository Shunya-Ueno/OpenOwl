import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/shared/theme/tokens';

interface ScreenProps extends PropsWithChildren {
  /** スクロールを伴わない固定レイアウトの画面で false にする(既定 true でパディングのみ)。 */
  padded?: boolean;
}

/**
 * 画面の共通レイアウト。SafeArea + キーボード回避 + 余白を1箇所に集約し、
 * 各画面が同じボイラープレートを書かないようにする。
 */
export function Screen({ children, padded = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.flex, padded && styles.padded]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
