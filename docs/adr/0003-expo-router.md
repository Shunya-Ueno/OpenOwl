# ADR-0003: ルーティングに Expo Router を採用する

- **状態**: Accepted
- **日付**: 2026-08-22
- **フェーズ**: 1

## 背景

iOS ネイティブと Web/PWA の両方に同一コードベースで対応する必要がある。
Web では OAuth のリダイレクトコールバック（`/auth/callback`）を URL として受け取る必要がある。

## 決定

`expo-router`（ファイルベースルーティング）を採用する。
React Navigation を直接使う構成は採らない。

## 理由

- Expo Router は React Navigation の上に構築されているため、ネイティブの遷移機能で劣らない。
- **Web で実 URL を持つ**。PWA として配信する以上、URL が成立することは事実上必須。
  React Navigation 単体で Web 対応する場合、`linking` 設定を手書きすることになり、
  画面を追加するたびにナビゲータ定義と URL 定義の 2 箇所を更新する必要がある。
- OAuth コールバック（`/auth/callback`）を 1 ファイルのルートとして自然に表現できる。
- ネイティブのディープリンク（`openowl://`）と Web の URL が同じ定義から導出されるため、
  プラットフォーム差異が 1 つ減る。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| React Navigation を直接使う | Web の URL 設計を手書きする必要があり、画面追加のたびに二重更新が発生する |
| Web だけ別のルーティング（react-router 等） | コードベースが分岐し、モノレポにした利点を失う |

## 結果 / 影響

- 画面は `frontend/app/` 配下のファイル構造で定義される。
- `react-native-screens` / `react-native-safe-area-context` が必須依存になる。
- Supabase Auth の Redirect URL 設計がルート構造に依存する（`/auth/callback`）。
