import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

/** セッション復元中の表示(docs/frontend-design.md 2 のフロー図の "loading" 状態)。 */
export function Splash() {
  return (
    <View style={styles.container} accessibilityLabel="読み込み中" accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
