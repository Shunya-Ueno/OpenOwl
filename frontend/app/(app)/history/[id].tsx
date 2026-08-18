import { useLocalSearchParams } from 'expo-router';
import { HistoryDetailScreen } from '@/features/synonyms/ui/HistoryDetailScreen';

export default function HistoryDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HistoryDetailScreen id={id} />;
}
