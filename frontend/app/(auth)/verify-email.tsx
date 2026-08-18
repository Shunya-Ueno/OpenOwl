import { useLocalSearchParams } from 'expo-router';
import { VerifyEmailScreen } from '@/features/auth/ui/VerifyEmailScreen';

export default function VerifyEmailRoute() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  return <VerifyEmailScreen email={email ?? ''} />;
}
