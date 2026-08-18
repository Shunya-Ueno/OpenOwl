# ADR-0009: フロントエンドを feature-based 構成にする

- **ステータス**: Accepted
- **日付**: 2026-08-18
- **決定者**: Claude（設計フェーズ / Opus）

## 背景

`frontend/src` の構成を、機能単位（feature-based）で切るか、
レイヤー単位（layer-based: `components/` `hooks/` `services/`）で切るかを決める必要がある。

MVP の機能は認証と類義語生成の2つだが、単語帳・例文生成・ロールプレイ会話の追加が
ロードマップ上で確定している。

## 選択肢

1. **layer-based** — 種類ごとに横断的に並べる
2. **feature-based** — 機能ごとに縦に切り、内部を layer で分ける
3. **ハイブリッド** — feature-based を主軸に、横断的関心事のみ `shared/` に置く

## 決定

**選択肢3（ハイブリッド）**。`src/features/<機能>/{domain,api,hooks,ui}` を基本とし、
2つ以上の feature から使われるものだけを `src/shared/` に置く。

## 理由

- **機能追加が1ディレクトリに閉じる。** 将来 `features/vocabulary/` を足すだけで機能が増え、
  不要になればディレクトリごと削除できる。layer-based では1機能の追加が
  4つ以上のディレクトリに散らばり、削除時に取り残しが出る。
- **feature 内部を layer で切ることで、責務分離は失わない。**
  `domain`（依存なし）→ `api` → `hooks` → `ui` の一方向依存を保つ。
  これは CLAUDE.md のレイヤー方針と、バックエンドの
  `domain / infrastructure / http`（[`../backend-design.md`](../backend-design.md)）と対応する。
- **純粋な feature-based を避ける理由**は、共通の `Button` や Supabase クライアントの
  置き場所が決まらないこと。どちらかの feature に置くと feature 間の相互 import が発生し、
  依存が双方向になって「機能ごと削除できる」という利点自体が壊れる。
- `shared/` の肥大化は「2つ以上から使われるものだけ」という基準で抑える。
  1箇所でしか使わないものを先回りで共通化しない（バックエンドの `_shared/` と同じ規約）。

## 影響

- **feature 間の直接 import を禁止する。** 参照したくなったら `shared/` に出す、が原則。
  唯一の例外は認証状態の購読で、これは `shared` 経由の Context として提供する。
- `app/`（Expo Router）は薄く保ち、`features/*/ui` の画面コンポーネントを返すだけにする。
- `features/*/domain` は React も Supabase SDK も import しない。
  この制約を破ると、ドメインの語彙がライブラリの都合に汚染される。
- MVP の feature は `auth` と `synonyms` の2つだけ。**先回りして空の feature を作らない。**
