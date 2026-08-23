import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { SocialSignInOutcome } from './AuthProviderTypes';

// docs/frontend-design.md 8.1〜8.2: ネイティブ UI から ID トークンを取得する。
// fullName は初回認可時にしか返らないため、呼び出し側でその場に保存する必要がある。
export async function signInWithApple(): Promise<SocialSignInOutcome> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error('Apple からトークンを取得できませんでした。');
    }

    const fullName =
      [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') ||
      null;

    return { kind: 'session', idToken: credential.identityToken, nonce: rawNonce, fullName };
  } catch (error) {
    if (isUserCancelledError(error)) return { kind: 'cancelled' };
    throw error;
  }
}

function isUserCancelledError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED'
  );
}
