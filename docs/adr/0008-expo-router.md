# ADR-0008: ルーティングに Expo Router を採用する

- **ステータス**: Accepted
- **日付**: 2026-08-18
- **決定者**: Claude（設計フェーズ / Opus）

## 背景

[ADR-0003](./0003-expo-managed-workflow.md) で Expo の採用を決めた際、
Expo Router を「第一候補、最終判断は Phase 4」としていた。ここで確定させる。

MVP の画面は7つで、うち3つは未認証時のみ、4つは認証済みのみに見せる必要がある。
また、メール確認リンクからアプリに戻る導線（ディープリンク）が必須である。

## 選択肢

1. **Expo Router**（ファイルベース、内部は React Navigation）
2. **React Navigation を直接使う**（画面とナビゲータを手で組む）

## 決定

**Expo Router を採用する。** ルートグループ `(auth)` / `(app)` で認証境界を表現する。

## 理由

- **認証ガードがルーティング構造そのものになる。** グループごとの `_layout.tsx` に
  リダイレクトを1つ書けば、その配下の画面すべてが保護される。
  React Navigation 直接利用だと「ナビゲータの出し分け」か「各画面でのチェック」になり、
  画面追加のたびにガードの付け忘れが起こりうる。
- **ディープリンクの設定が規約になる。** メール確認リンク（`openowl://auth-callback`）の
  受け口を、URL とファイルパスの対応として宣言的に持てる。
  React Navigation では `linking` 設定に画面構造を二重に書くことになる。
- **React Navigation の知見がそのまま使える。** Expo Router は React Navigation の上に
  構築されているため、タブ・スタックの挙動やオプションは同じ。捨てる知識がない。
- Expo を採用している以上、Expo Router は既定の選択肢であり、
  ドキュメントとサンプルの追随が最も良い。

## 影響

- `app/` ディレクトリがルーティングの規約になるため、**画面の実装をここに書かない**規約が必要になる
  （[`../frontend/directory-structure.md`](../frontend/directory-structure.md)）。
  ファイル配置＝URL 構造なので、実装を置くと「画面の再配置」がそのまま実装の移動になってしまう。
- 認証によるリダイレクトを持つファイルは `(auth)/_layout.tsx` と `(app)/_layout.tsx` の2つだけ、
  というルールを守る必要がある。
- 起動時のセッション復元中に `unauthenticated` と判定してしまうと、
  サインイン画面が一瞬見えてからホームに飛ぶ。`initializing` 状態を明示的に持ち、
  その間はスプラッシュを維持する（[`../frontend/state-management.md`](../frontend/state-management.md)）。
