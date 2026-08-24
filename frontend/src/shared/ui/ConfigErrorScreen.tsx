import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { testIds } from '../testIds';

interface ConfigErrorScreenProps {
  readonly message: string;
}

/**
 * ビルドに環境変数が埋め込まれていないときに出す画面
 * (docs/frontend-design.md 13.1)。
 *
 * `EXPO_PUBLIC_*` は**ビルド時**にバンドルへ埋め込まれるため、
 * デプロイ先の環境変数が未設定のままビルドすると、実行時にはもう手当てできない。
 * 以前はこの状況で例外を投げて**真っ白な画面**になり、
 * DevTools を開かないと原因が分からなかった。
 *
 * 利用者向けの画面ではなく、デプロイした本人向けの画面である。
 * 変数名は公開前提の値なので画面に出してよい(値は出さない)。
 */
export function ConfigErrorScreen({ message }: ConfigErrorScreenProps) {
  return (
    <View style={styles.container} testID={testIds.configError}>
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          設定が完了していません
        </Text>

        <Text style={styles.message}>{message}</Text>

        <Text style={styles.hint}>
          これらはビルド時に埋め込まれる値です。デプロイ先（Vercel）の環境変数を設定したうえで、
          再デプロイしてください。設定方法は docs/deployment.md を参照してください。
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  message: {
    ...typography.body,
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
