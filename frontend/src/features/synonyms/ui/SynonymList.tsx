import { View } from 'react-native';
import type { Synonym } from '../domain/Synonym';
import { SynonymCard } from './SynonymCard';

interface SynonymListProps {
  synonyms: readonly Synonym[];
}

export function SynonymList({ synonyms }: SynonymListProps) {
  return (
    <View testID="synonym-list">
      {synonyms.map((synonym) => (
        <SynonymCard key={synonym.id ?? synonym.sortOrder} synonym={synonym} />
      ))}
    </View>
  );
}
