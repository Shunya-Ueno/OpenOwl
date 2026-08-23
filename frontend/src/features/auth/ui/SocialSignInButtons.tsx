import { Platform, View, StyleSheet } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { spacing } from '../../../shared/theme/tokens';

interface SocialSignInButtonsProps {
  readonly onPressGoogle: () => void;
  readonly onPressApple: () => void;
  readonly googleLoading: boolean;
  readonly appleLoading: boolean;
  readonly disabled: boolean;
}

// docs/frontend-design.md 8.1: 主戦場は iOS ネイティブ + Web/PWA。
// Apple ログインは Android では提供しない(expo-apple-authentication は iOS 専用)。
export function SocialSignInButtons({
  onPressGoogle,
  onPressApple,
  googleLoading,
  appleLoading,
  disabled,
}: SocialSignInButtonsProps) {
  const showApple = Platform.OS === 'ios' || Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <Button
        label="Google で続ける"
        variant="secondary"
        onPress={onPressGoogle}
        loading={googleLoading}
        disabled={disabled}
      />
      {showApple ? (
        <Button
          label="Apple で続ける"
          variant="secondary"
          onPress={onPressApple}
          loading={appleLoading}
          disabled={disabled}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
});
