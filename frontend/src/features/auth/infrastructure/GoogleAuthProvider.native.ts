import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { env } from '../../../shared/config/env';
import type { SocialSignInOutcome } from './AuthProviderTypes';

// docs/frontend-design.md 8.1: ネイティブは expo-auth-session で ID トークンを
// 直接取得し、signInWithIdToken に渡す。
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};

export async function signInWithGoogle(): Promise<SocialSignInOutcome> {
  if (!env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
    throw new Error(
      'Google ログインが未設定です(EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)。frontend/.env.example を参照してください。',
    );
  }

  // Google 側にはハッシュ化した nonce を渡し、Supabase には生の nonce を渡す。
  // Supabase 側で再ハッシュして ID トークンの nonce クレームと突き合わせる。
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const request = new AuthSession.AuthRequest({
    clientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'openowl' }),
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: { nonce: hashedNonce },
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { kind: 'cancelled' };
  }
  if (result.type !== 'success' || typeof result.params.id_token !== 'string') {
    throw new Error('Google ログインに失敗しました。');
  }

  return { kind: 'session', idToken: result.params.id_token, nonce: rawNonce };
}
