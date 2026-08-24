import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useProfile, useUpdateDisplayName } from '../../src/features/profile/application/useProfile';
import { ProfileForm } from '../../src/features/profile/ui/ProfileForm';
import { useSignOut } from '../../src/features/auth/application/useSignOut';
import { useUserId } from '../../src/features/auth/authStore';
import { Button } from '../../src/shared/ui/Button';
import { Splash } from '../../src/shared/ui/Splash';
import { Banner } from '../../src/shared/ui/Banner';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';
import { testIds } from '../../src/shared/testIds';

export default function SettingsScreen() {
  const userId = useUserId();
  const profile = useProfile();
  const updateDisplayName = useUpdateDisplayName(userId ?? '');
  const signOut = useSignOut();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          testID={testIds.settings.back}
          accessibilityRole="button"
          accessibilityLabel="戻る"
        >
          <Text style={styles.back}>← 戻る</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" testID={testIds.settings.title}>
          設定
        </Text>
      </View>

      {profile.isLoading ? <Splash /> : null}

      {profile.isError ? (
        <Banner
          tone="danger"
          message="プロフィールを取得できませんでした。"
          testID={testIds.settings.error}
        />
      ) : null}

      {profile.data ? (
        <ProfileForm
          initialDisplayName={profile.data.displayName}
          saving={updateDisplayName.isPending}
          onSave={(displayName) => updateDisplayName.mutate(displayName)}
        />
      ) : null}

      <View style={styles.signOutSection}>
        <Button
          testID={testIds.settings.signOut}
          label="サインアウト"
          variant="danger"
          onPress={() => signOut.mutate()}
          loading={signOut.isPending}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  headerRow: {
    gap: spacing.sm,
  },
  back: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  signOutSection: {
    marginTop: spacing.xl,
  },
});
