import type { TextInput } from 'react-native';
import { forwardRef } from 'react';
import { TextField } from '@/shared/ui/TextField';

interface WordInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  error?: string;
}

export const WordInputField = forwardRef<TextInput, WordInputFieldProps>(
  ({ value, onChangeText, onBlur, error }, ref) => {
    return (
      <TextField
        ref={ref}
        testID="home-word-input"
        label="英単語"
        placeholder="例: happy"
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        error={error}
        returnKeyType="done"
        autoComplete="off"
        maxLength={64}
      />
    );
  },
);
WordInputField.displayName = 'WordInputField';
