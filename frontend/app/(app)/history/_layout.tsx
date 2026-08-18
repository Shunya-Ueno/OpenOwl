import { Stack } from 'expo-router';

export default function HistoryLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '履歴' }} />
      <Stack.Screen name="[id]" options={{ title: '詳細' }} />
    </Stack>
  );
}
