import * as Linking from 'expo-linking';

/**
 * 認証メール(確認・パスワード再設定)からアプリへ戻るためのリンク先。
 *
 * backend/supabase/config.toml の `additional_redirect_urls` に登録された値と
 * 一致している必要がある。ここがズレると Supabase 側でリダイレクトが拒否される。
 *
 * 開発時(Expo Go / dev client)はスキームが異なるため `Linking.createURL` で
 * 実行環境に応じた URL を組み立てる。本番のスタンドアロンビルドでは
 * app.config.ts の `scheme` から `openowl://auth-callback` が生成される。
 */
export const AUTH_CALLBACK_PATH = 'auth-callback';

export function authCallbackUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}
