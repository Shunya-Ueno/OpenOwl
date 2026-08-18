import { ActivityIndicator, type ColorValue } from 'react-native';
import { colors } from '@/shared/theme/tokens';

interface SpinnerProps {
  color?: ColorValue;
  size?: 'small' | 'large';
}

export function Spinner({ color = colors.primary, size = 'small' }: SpinnerProps) {
  return <ActivityIndicator color={color} size={size} />;
}
