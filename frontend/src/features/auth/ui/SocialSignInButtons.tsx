import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button } from '@/shared/ui/Button';
import { spacing } from '@/shared/theme/tokens';

interface SocialSignInButtonsProps {
  onGooglePress: () => void;
  onApplePress: () => void;
  googleLoading: boolean;
  appleLoading: boolean;
  disabled: boolean;
  /** Google のクライアント ID が未設定のときは false。押しても必ず失敗するため出さない。 */
  showGoogle: boolean;
}

/**
 * Apple のボタンは iOS でのみ表示する。Android では expo-apple-authentication が
 * 使えず、表示しても押せないボタンになるため(docs/frontend/screens.md)。
 * Apple 側は公式コンポーネント(AppleAuthenticationButton)を使い、ブランドガイドラインに沿う。
 */
export function SocialSignInButtons({
  onGooglePress,
  onApplePress,
  googleLoading,
  appleLoading,
  disabled,
  showGoogle,
}: SocialSignInButtonsProps) {
  return (
    <View style={styles.container}>
      {showGoogle ? (
        <Button
          label="Google で続ける"
          variant="secondary"
          onPress={onGooglePress}
          loading={googleLoading}
          disabled={disabled}
          testID="sign-in-google-button"
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={[styles.appleButton, (appleLoading || disabled) && styles.appleButtonDisabled]}
          onPress={() => {
            // ネイティブボタンには disabled プロパティがないため、多重タップの防止は
            // ここでガードする(実際の抑止は呼び出し側の mutation.isPending にも依存)。
            if (!appleLoading && !disabled) onApplePress();
          }}
          testID="sign-in-apple-button"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  appleButtonDisabled: {
    opacity: 0.5,
  },
});
