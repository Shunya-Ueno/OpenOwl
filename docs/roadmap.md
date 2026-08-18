# ロードマップとスコープ

## MVP のゴール

App Store 掲載を目標とした外国語学習アプリ。
**MVP のスコープは「認証」と「類義語生成」の2機能のみ**とし、それ以外は実装しない。

## 機能スコープ

### MVP に含むもの

| # | 機能 | 内容 |
| --- | --- | --- |
| 1 | 認証 | メール＋パスワードのサインアップ／ログイン、Google ログイン、Apple ログイン（iOS審査要件） |
| 2 | 類義語生成 | 英単語を1つ入力 → Edge Functions 経由で Gemini Flash-Lite を呼び出し → 類義語を表示 → 結果を DB に保存 |

### MVP に含まないもの（将来機能）

- 単語帳（保存した単語の一覧・復習）
- 例文生成
- ロールプレイ会話
- 学習履歴の統計・可視化
- 課金／サブスクリプション

これらは**実装しない**が、DB スキーマと API 層が将来の追加を阻害しないことを設計時に確認する
（[`db-schema.md` の「将来拡張」](./db-schema.md#将来拡張の受け皿)を参照）。
一方で、将来機能のためのテーブルやエンドポイントを先回りして作ることはしない（YAGNI）。

## 開発フェーズ

| Phase | 内容 | 担当モデル | 状態 |
| --- | --- | --- | --- |
| 0 | `docs/` 構成設計、`README.md`、`CLAUDE.md` の作成 | Opus / Fable（設計） | ✅ 完了 |
| 1 | リポジトリ構成・技術選定の確認 | Opus / Fable（設計） | ✅ 完了 |
| 2 | バックエンド設計（DBスキーマ、Edge Functions、API仕様、RLS） | Opus / Fable（設計） | ✅ 完了 |
| 3 | バックエンド実装（マイグレーション、Edge Functions） | Sonnet（実装） | 🟡 Supabase プロジェクトへ適用・デプロイ済み / Gemini API 未接続(注1) |
| 4 | フロントエンド設計（画面構成、状態管理、ディレクトリ構造） | Opus / Fable（設計） | ✅ 完了 |
| 5 | フロントエンド実装 | Sonnet（実装） | 🟡 コード実装済み / 実機・シミュレータでの検証は未実施(注2) |
| 6 | E2Eテスト・CI 設定 | Sonnet（実装） | ⬜ 未着手 |

**Phase 2 完了時点でいったん停止し、人間のレビューを受ける。**

> **注1（Phase 3 の状態について）**: `backend/` 一式（マイグレーション・RLS・Edge Function）は
> [`docs/backend-design.md`](./backend-design.md) に基づいて実装し、Supabase MCP 経由で
> テスト用プロジェクト `OpenOwl-feature`（`vaaaiatfouoaljsitstv` / ap-south-1）に反映済みです。
>
> **実施済み**:
> - マイグレーション3本を適用（`init_schema` / `restrict_handle_new_user_execute` /
>   `index_search_history_fk_columns`。後者2つはコードレビューと Supabase Advisor の指摘を受けた追加修正）
> - `generate-synonyms` Edge Function をデプロイ（`ACTIVE`、`verify_jwt=false`。
>   理由は [`security.md`](./security.md#edge-functions-のセキュリティ) 参照）
> - Supabase Advisor（security / performance）を確認し、指摘はすべて解消済み（0件）
> - 実 DB から型を生成し、`database.types.ts` を検証・反映（RPC引数の nullability のみ手動補正）
>
> **未実施**（[Phase 3 の完了条件](./backend-design.md#実装フェーズphase-3の完了条件)の残り）:
> - `GEMINI_API_KEY` の登録（API キー入力は AI が代行しない方針のため、オーナー作業待ち）
> - 実際の Gemini API を使った成功パス・異常系（レート制限・タイムアウト等）の動作確認
> - RLS の実クエリ検証6項目（[`security.md`](./security.md#rls-の検証phase-3-の完了条件)）—
>   テストユーザーの作成を伴うため、キー登録後にあわせて実施する
> - `deno lint` / `deno check` によるコンパイル確認（この作業環境に Deno がないため未実行）
>
> オーナーが `GEMINI_API_KEY` を登録し次第、上記の残項目を実施して Phase 3 を ✅ 完了にしてください。

> **注2（Phase 5 の状態について）**: `frontend/`(Expo Router + TypeScript)を
> [`docs/frontend/screens.md`](./frontend/screens.md) 以下の設計に基づいて実装しました。
>
> **実施済み**:
> - 画面7枚 + パスワード再設定画面(screens.md で推奨、オーナー確認済み)をすべて実装
> - `features/{auth,synonyms}/{domain,api,hooks,ui}` の構成、`shared/` の共通化(directory-structure.md 通り)
> - 認証状態は `AuthProvider`(Context)、サーバ状態は TanStack Query、類義語生成は
>   **useMutation**(useQuery にすると画面復帰のたびに再課金されうるため。state-management.md)
> - SecureStore の 2KB 制限に対するチャンク分割保存アダプタ(`SecureSessionStorage`)
> - `npx tsc --noEmit` / `npx eslint .` を実行し、エラー0件を確認
> - `npx expo config` の評価に成功、`expo-doctor` は21項目中19件通過
>   (残り2件はこの環境からの外部ホストへの到達がブロックされているための誤検知)
>
> **未実施**:
> - 実機・シミュレータでの起動確認、画面遷移・フォーム操作の目視確認(この開発環境に
>   シミュレータがないため)
> - Google/Apple サインインの実接続確認(OAuth クライアント未発行のため。下記ブロッカー参照)
> - `deno` 側と異なり、こちらの `lint`/`typecheck` は実行・確認済み
>
> **設計からの差分・スコープ判断**(実装時に決定。詳細はコード内コメント参照):
> - **アカウント削除画面は実装したが、対応する `delete-account` Edge Function は未実装。**
>   呼び出すと失敗する。バックエンド側の追加実装(Phase 3 の追加スコープ)が必要
>   (`frontend/src/features/auth/api/SupabaseAuthClient.ts` にコメントで明記)
> - 「前回の結果を表示」フォールバック(error-handling.md)は、簡易版として
>   ホーム画面のエラー時に履歴タブへの導線を表示する形に留めた。単語ごとの
>   インライン再表示は行っていない(新しいクエリ方法の追加を避けるための判断)
>
> 実機・シミュレータでの確認と、上記の差分に対する対応方針の判断をお願いします。

### モデル使い分けの原則

- **設計・コードレビュー・リファクタリング**: Opus または Fable
  （Phase 0/1/2/4、および各実装フェーズ後のセルフレビュー・リファクタリング工程）
- **実装（コーディング作業そのもの）**: Sonnet をメインで使用
  （Phase 3/5/6 のコード記述、テストコード、CI 設定ファイル）

各フェーズの成果報告時に、使用したモデルを明記する。

## 人間の作業が必要なブロッカー

以下は AI 側では完結せず、**人間（プロジェクトオーナー）の作業が必須**。
Phase 3 に入る前に完了している必要がある。

| # | 作業 | 必要になるフェーズ | 備考 |
| --- | --- | --- | --- |
| 1 | ~~Supabase プロジェクト作成（本番用・テスト用の2つ）~~ | Phase 3 | ✅ 完了。本番用 `OpenOwl`（ap-northeast-1 / `pbhxklsjsvnaovwdvkbx`）、テスト用 `OpenOwl-feature`（ap-south-1 / `vaaaiatfouoaljsitstv`）。マイグレーション・Function は現在テスト用にのみ反映済み |
| 2 | Google AI Studio で Gemini API キー発行、`supabase secrets set GEMINI_API_KEY=...` で登録 | Phase 3 | **未完了・次のブロッカー**。無料枠あり。キーは AI に渡さずオーナーが直接登録する |
| 3 | Google Cloud Console で OAuth クライアント ID 発行（iOS / Android / Web） | Phase 5 | Google ログイン用 |
| 4 | Apple Developer Program 加入（年額 $99）と Sign in with Apple の設定 | Phase 5 | App Store 掲載と Apple ログインに必須 |
| 5 | Supabase ダッシュボードでの各 Provider 有効化とシークレット登録 | Phase 3 / 5 | キーは AI に渡さず、オーナーが直接登録する |

課金が発生する契約（4 および Supabase / Gemini の有料プラン移行）は、
**必ずオーナーの判断を仰いでから**進める。
