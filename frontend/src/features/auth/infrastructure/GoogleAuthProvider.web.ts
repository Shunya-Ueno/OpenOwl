import * as Linking from 'expo-linking';
import { authGateway } from './SupabaseAuthGateway';
import type { SocialSignInOutcome } from './AuthProviderTypes';

// docs/frontend-design.md 8.1: Web は Supabase 側の OAuth 設定を使い、
// signInWithOAuth でリダイレクトさせる。クライアント ID はフロントに持たない。
export async function signInWithGoogle(): Promise<SocialSignInOutcome> {
  const redirectTo = Linking.createURL('auth/callback');
  await authGateway.signInWithOAuthRedirect('google', redirectTo);
  return { kind: 'redirecting' };
}
