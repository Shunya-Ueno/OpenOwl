import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextField } from '../../../shared/ui/TextField';
import { Button } from '../../../shared/ui/Button';
import { spacing } from '../../../shared/theme/tokens';
import { testIds } from '../../../shared/testIds';

interface ProfileFormProps {
  readonly initialDisplayName: string | null;
  readonly saving: boolean;
  readonly onSave: (displayName: string | null) => void;
}

export function ProfileForm({ initialDisplayName, saving, onSave }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');

  useEffect(() => {
    setDisplayName(initialDisplayName ?? '');
  }, [initialDisplayName]);

  const handleSave = () => {
    const trimmed = displayName.trim();
    onSave(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <View style={styles.container}>
      <TextField
        testID={testIds.settings.displayName}
        label="表示名"
        value={displayName}
        onChangeText={setDisplayName}
        editable={!saving}
        maxLength={50}
      />
      <Button testID={testIds.settings.save} label="保存" onPress={handleSave} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
