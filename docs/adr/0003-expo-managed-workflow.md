# ADR-0003: React Native の実行基盤に Expo を採用する

- **ステータス**: Accepted
- **日付**: 2026-08-16
- **決定者**: Claude（設計フェーズ / Opus）

## 背景

技術スタックは「React Native + TypeScript」で確定しているが、
Expo を使うか、Bare React Native（`react-native init` 相当）で組むかは未決定。
App Store 掲載が目標であり、Apple ログイン・Google ログインの実装が MVP に含まれる。

## 選択肢

1. **Expo（Config Plugin + Development Build + EAS Build）**
2. **Bare React Native** — ネイティブプロジェクトを直接管理する

## 決定

**Expo を採用する。** ネイティブモジュールが必要になるため Expo Go ではなく
Development Build を使い、リリースは EAS Build / EAS Submit で行う。

## 理由

- **審査要件を満たすための実装が公式に揃っている。**
  `expo-apple-authentication` により Sign in with Apple をネイティブ UI で実装できる。
  Apple ログインは、他のソーシャルログインを提供する iOS アプリの審査要件であり、MVP 必須項目。
- **iOS ビルドに macOS が要らない。** EAS Build がクラウドで iOS ビルドを行うため、
  開発環境と CI（GitHub Actions、Phase 6）の両方で macOS ランナーへの依存を減らせる。
- **ネイティブ設定の差分管理が config plugin に寄る。**
  Google/Apple ログインは `Info.plist`・`entitlements`・URL スキームの設定を伴う。
  Bare だとこれらを手で維持することになり、認証設定の変更が iOS/Android の
  ネイティブファイル双方への手作業になる。
- **Expo は React Native を隠さない。** 必要になれば `expo prebuild` でネイティブプロジェクトを
  出力して直接編集できるため、後戻りの余地がある（不可逆な選択ではない）。
- ユーザー指定の「React Native + TypeScript」という制約に反しない。Expo は React Native の上の層。

## 影響

- Expo Go では動かない（ネイティブモジュールを含むため）。開発者は Development Build を端末に入れる。
- EAS Build のビルド時間・従量課金が発生しうる。無料枠を超える場合は**オーナーの判断を仰ぐ**
  （課金判断は AI 側で行わない）。
- ルーティングは Expo Router を第一候補とする（OAuth コールバックのディープリンク処理が標準化されているため）。
  最終判断は Phase 4。
- Apple Developer Program（年額 $99）の加入は必須。これはオーナー側の作業。
