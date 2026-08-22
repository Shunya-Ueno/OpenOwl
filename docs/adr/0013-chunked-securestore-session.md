# ADR-0013: ネイティブのセッション永続化に分割 SecureStore アダプタを使う

- **状態**: Accepted
- **日付**: 2026-08-22
- **フェーズ**: 4

## 背景

iOS ネイティブではセッションを `expo-secure-store`（Keychain）に保存する方針を
フェーズ 1 で決めている（[`architecture.md`](../architecture.md) §6）。

しかし SecureStore には 1 値あたり約 2048 バイトの上限がある。
Supabase のセッション JSON は access token（JWT）・refresh token・user オブジェクトを
含むため、この上限を超えうる。超えた場合、保存は成功したように見えて値が入らず、
**「アプリを再起動するとログアウトしている」**という再現しにくい不具合になる。

フェーズ 1 の時点では「JWT の保存方式はフェーズ 4 で確定する」と保留していた。

## 決定

`SupportedStorage` インターフェースを実装する**分割保存アダプタ**を
`src/shared/supabase/SessionStorage.native.ts` に置き、`createClient` に渡す。

- `setItem`: 値をチャンクに分割し、`<key>.0` / `<key>.1` … と `<key>.__chunks`（個数）に保存
- `getItem`: `__chunks` を読んで結合。欠損があれば `null` を返す（壊れた状態を返さない）
- `removeItem`: `__chunks` を読んで全チャンクを削除する

Web 側は `SessionStorage.web.ts` で `localStorage` をそのまま使う（supabase-js の既定）。

## 理由

- SecureStore の上限は回避しようがなく、超えるかどうかがトークン長に依存するため
  「今は動いているが、あるユーザーで壊れる」という形の不具合になる。
  事前に分割しておけば長さに依存しない。
- AsyncStorage に平文で置く選択肢もあるが、リフレッシュトークンは
  長期の認証情報であり、Keychain に置く方が妥当。
- 削除時にチャンクを消し残すと、次回の復元で古い断片と新しい断片が混ざる。
  `__chunks` を単一の真実として扱い、削除もそこから辿る。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| SecureStore をそのまま使う | 上限超過時に無言で壊れる。トークン長依存で再現性が低い |
| AsyncStorage に平文保存 | リフレッシュトークンを平文で端末に置くことになる |
| セッションを永続化しない（毎回ログイン） | 学習アプリとして日常利用に耐えない |

## 結果 / 影響

- `createClient` の `auth.storage` にプラットフォーム別アダプタを渡す。
  `SessionStorage.native.ts` / `SessionStorage.web.ts` のファイル分割で解決する。
- 分割アダプタは自作コードなので、フェーズ 5 で**実機**での復元を必ず確認する
  （シミュレータだけでなく、アプリを完全終了してから再起動する経路）。
- Web の `localStorage` は XSS 時の奪取リスクを持つが、静的配信のみの構成では
  HttpOnly Cookie を選べない。[`security.md`](../security.md) §8 の方針で担保する。
