import type { Session } from '@supabase/supabase-js';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/shared/api/supabaseClient';
import { translateAuthErrorMessage } from '../domain/AuthErrorTranslator';

export type SignInOutcome = 'signed_in' | 'cancelled';

/**
 * Supabase Auth とネイティブのソーシャルログイン SDK をまとめて扱うクラス。
 * feature 内の唯一の Supabase SDK への接点とし、hooks/ui からは常にこれを経由させる。
 *
 * エラーは Supabase の生メッセージのまま投げず、日本語に翻訳してから throw する
 * (呼び出し側が Supabase SDK のエラー形を知らなくて済むようにする)。
 */
export class SupabaseAuthClient {
  private googleConfigured = false;

  /** app/_layout.tsx から起動時に1度だけ呼ぶ。 */
  configureGoogleSignIn(): void {
    if (this.googleConfigured) return;
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      // Phase 5 の人間側ブロッカー(Google OAuth クライアント未発行)が未解消のうちは
      // 設定をスキップする。ボタンを押したときにのみエラーになる(起動は妨げない)。
      return;
    }
    GoogleSignin.configure({ webClientId });
    this.googleConfigured = true;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(translateAuthErrorMessage(error));
    return data.session;
  }

  /** @returns 購読解除用の関数 */
  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => data.subscription.unsubscribe();
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  async signUpWithEmail(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  async resendConfirmationEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'openowl://auth-callback',
    });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  /**
   * アカウント削除。
   *
   * 注意: `delete-account` Edge Function はまだバックエンドに実装されていない
   * (Phase 3 の完了時点では generate-synonyms のみ)。呼び出すと 404 になる。
   * バックエンド側の追加実装が完了してから有効化すること。
   */
  async deleteAccount(): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      throw new Error('アカウントの削除に失敗しました。しばらくしてからもう一度お試しください。');
    }
  }

  async signInWithGoogle(): Promise<SignInOutcome> {
    this.configureGoogleSignIn();
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('Google からトークンを取得できませんでした。もう一度お試しください。');
      }
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw new Error(translateAuthErrorMessage(error));
      return 'signed_in';
    } catch (caught) {
      if (isErrorWithCode(caught) && caught.code === statusCodes.SIGN_IN_CANCELLED) {
        return 'cancelled';
      }
      throw caught;
    }
  }

  async signInWithApple(): Promise<SignInOutcome> {
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple からトークンを取得できませんでした。もう一度お試しください。');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw new Error(translateAuthErrorMessage(error));
      return 'signed_in';
    } catch (caught) {
      if (
        typeof caught === 'object' &&
        caught !== null &&
        'code' in caught &&
        (caught as { code: unknown }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return 'cancelled';
      }
      throw caught;
    }
  }
}

export const authClient = new SupabaseAuthClient();
