import * as Linking from 'expo-linking';
import { authGateway } from './SupabaseAuthGateway';
import type { SocialSignInOutcome } from './AuthProviderTypes';

export async function signInWithApple(): Promise<SocialSignInOutcome> {
  const redirectTo = Linking.createURL('auth/callback');
  await authGateway.signInWithOAuthRedirect('apple', redirectTo);
  return { kind: 'redirecting' };
}
