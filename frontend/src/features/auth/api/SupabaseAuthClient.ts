import type { Session } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/shared/api/supabaseClient';
import { authCallbackUrl } from '@/shared/api/authRedirect';
import { translateAuthErrorMessage } from '../domain/AuthErrorTranslator';

export type SignInOutcome = 'signed_in' | 'cancelled';

/** 認証メールのリンク種別。recovery はパスワード再設定、other はメール確認など。 */
export type AuthCallbackType = 'recovery' | 'other';

export interface AuthCallbackResult {
  readonly session: Session | null;
  readonly type: AuthCallbackType;
}

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
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (!webClientId) {
      // Phase 5 の人間側ブロッカー(Google OAuth クライアント未発行)が未解消のうちは
      // 設定をスキップする。ボタンを押したときにのみエラーになる(起動は妨げない)。
      return;
    }
    // webClientId は Supabase に渡す ID トークンの audience を決めるため必須。
    // iosClientId は iOS のネイティブフローに必要で、Web 用の ID では代用できない
    // (種別が違うクライアントとして Google 側に登録されるため)。
    GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}) });
    this.googleConfigured = true;
  }

  /** Google ログインが利用可能か(必要なクライアントIDが設定されているか)。 */
  isGoogleSignInAvailable(): boolean {
    return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
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
    // emailRedirectTo を渡さないと確認メールのリンクが Supabase の site_url
    // (ローカルでは http://127.0.0.1:3000)に向き、端末から登録を完了できない。
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authCallbackUrl() },
    });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  async resendConfirmationEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl(),
    });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  /** パスワード再設定リンクから復帰したあと、新しいパスワードを設定する。 */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  /**
   * 認証メールのリンク(ディープリンク)からセッションを確立する。
   *
   * Supabase は PKCE の場合 `?code=`、implicit の場合 `#access_token=` を付けて戻す。
   * どちらで戻るかはプロジェクト設定に依存するため両方を扱う。
   * `type` はリンクの種類(recovery=パスワード再設定 / signup=メール確認)で、
   * 遷移先の判断に使う。
   */
  async establishSessionFromUrl(url: string): Promise<AuthCallbackResult> {
    const parsed = new URL(url);
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const linkType = parsed.searchParams.get('type') ?? fragment.get('type');
    const type: AuthCallbackType = linkType === 'recovery' ? 'recovery' : 'other';

    const errorDescription =
      parsed.searchParams.get('error_description') ?? fragment.get('error_description');
    if (errorDescription) {
      throw new Error('リンクの有効期限が切れています。もう一度お試しください。');
    }

    const code = parsed.searchParams.get('code');
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error(translateAuthErrorMessage(error));
      return { session: data.session, type };
    }

    // implicit フロー: フラグメントにトークンが入る。
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw new Error(translateAuthErrorMessage(error));
      return { session: data.session, type };
    }

    return { session: null, type };
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(translateAuthErrorMessage(error));
  }

  /**
   * アカウント削除。
   *
   * `delete-account` Edge Function が `auth.users` から削除すると、`profiles` /
   * `search_history` は on delete cascade で連鎖削除される(db-schema.md)。
   *
   * Function 成功後にクライアント側で明示的に signOut する。理由: サーバ側で
   * ユーザーが消えても、手元に残ったアクセストークンは自動では失効通知されない
   * (次のリフレッシュ時か、失効済みトークンで API を叩いて初めて 401 になる)。
   * signOut せずに放置すると、削除後もローカルには一瞬「ログイン中」の状態が残る。
   */
  async deleteAccount(): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      throw new Error('アカウントの削除に失敗しました。しばらくしてからもう一度お試しください。');
    }
    await supabase.auth.signOut();
  }

  async signInWithGoogle(): Promise<SignInOutcome> {
    if (!this.isGoogleSignInAvailable()) {
      throw new Error('Google ログインは現在ご利用いただけません。');
    }
    this.configureGoogleSignIn();
    await GoogleSignin.hasPlayServices();

    // このライブラリ(v16)ではキャンセルは例外ではなく戻り値で表現される
    // ({ type: 'cancelled' })。例外として扱うとユーザーが自分で閉じただけの操作に
    // エラーバナーが出てしまう。
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return 'cancelled';
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error('Google からトークンを取得できませんでした。もう一度お試しください。');
    }
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw new Error(translateAuthErrorMessage(error));
    return 'signed_in';
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
