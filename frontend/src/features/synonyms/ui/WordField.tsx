import { View, StyleSheet } from 'react-native';
import { TextField } from '../../../shared/ui/TextField';
import { Button } from '../../../shared/ui/Button';
import { spacing } from '../../../shared/theme/tokens';
import { testIds } from '../../../shared/testIds';

interface WordFieldProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSubmit: () => void;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
}

export function WordField({ value, onChangeText, onSubmit, submitting, errorMessage }: WordFieldProps) {
  return (
    <View style={styles.container}>
      <TextField
        testID={testIds.home.wordInput}
        label="英単語"
        placeholder="例: improve"
        value={value}
        onChangeText={onChangeText}
        errorMessage={errorMessage}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        editable={!submitting}
      />
      <Button testID={testIds.home.generate} label="類義語を生成" onPress={onSubmit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
