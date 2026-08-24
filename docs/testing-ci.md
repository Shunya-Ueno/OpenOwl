# テスト / CI / デプロイパイプライン設計

フェーズ 6 の正典。**モック禁止**（[roadmap.md](./roadmap.md)、[CLAUDE.md](../CLAUDE.md)）という
前提がテスト戦略のほぼすべてを決めているため、まずそこから出発する。

## 1. モック禁止がテスト設計に課す制約

「実 Supabase・実 DeepSeek に接続する」という方針は、一般的なテストピラミッドの
**中間層（統合テストをテストダブルで組む層）を丸ごと禁止する**ことを意味する。

残るのは次の 2 つだけである。

| 層 | 何をテストできるか | 外部依存 |
| --- | --- | --- |
| **単体テスト** | 外部 I/O を持たない純粋なロジック（正規化規則、バリデーション、エラー写像、プロンプト組み立て） | なし |
| **E2E テスト** | 画面 → Edge Function → Postgres → DeepSeek の通し | 実サービス |

**この 2 層の間は空にする。** 「Supabase クライアントを差し替えてリポジトリ実装を試す」
「`fetch` を差し替えて `DeepSeekClient` を試す」といったテストは書かない。
書けば、それはテストダブルであり方針違反になる。

### 1.1 ポート（`interface`）をテストに使わない

[architecture.md](./architecture.md) §4 と [llm-integration.md](./llm-integration.md) §5 が
繰り返し述べているとおり、本プロジェクトの `interface` は**テストダブル差し替えのために存在しない**。
フェーズ 6 でもこの原則を曲げない。`SynonymProvider` の偽実装を作って
`GenerateSynonymsUseCase` を単体テストする、という誘惑には乗らない。
ユースケースの正しさは E2E が担保する。

### 1.2 「テストランナー」はモックではない

念のため区別を明示しておく。禁止しているのは**被テスト対象の依存を偽物に差し替えること**であって、
テストを実行する道具（Deno の `Deno.test`、Vitest、Playwright、Maestro）は対象外である。
Playwright の `page.route()` によるレスポンス差し替えは**モックに該当するため使わない**。
ネットワークの**観測**（`page.on('request')` でリクエストの有無を数える）は差し替えではないので使う。

## 2. テスト対象の切り分け

### 2.1 単体テスト（純粋ロジックのみ）

| 対象 | 場所 | 何を守るテストか |
| --- | --- | --- |
| `Term.fromInput` | `backend/.../domain/Term.test.ts` | 正規化規則（trim → 連続空白圧縮 → 小文字化）と文字種制限。プロンプトインジェクション対策の要（[security.md](./security.md) §3） |
| `mapDomainErrorToHttp` | `backend/.../interface/HttpError.test.ts` | 例外 → HTTP ステータス／`code` の写像が [api-spec.md](./api-spec.md) §2.5 の表と一致すること |
| `generateSynonymsRequestSchema` | `backend/.../interface/RequestSchema.test.ts` | 既定値（`maxResults: 8` 等）と未知フィールドの無視 |
| `SynonymPromptBuilder` | `backend/.../deepseek/SynonymPromptBuilder.test.ts` | システムプロンプトが**先頭で完全固定**であること（プロンプトキャッシュのヒット率がコストに直結する） |
| `WordInput` | `frontend/.../domain/WordInput.test.ts` | クライアント側検証がサーバー側 `Term` と同じ規則であること |
| `parseErrorResponse` | `frontend/.../api/parseErrorResponse.test.ts` | 未知の `code` を `internal_error` に丸めること |
| `getAuthErrorMessage` | `frontend/.../auth/authErrorMessage.test.ts` | `AuthError#code` での分岐（メッセージ文字列で分岐していないこと） |

**コンポーネントの単体テスト（React Testing Library 等）は書かない。**
レンダラを差し替える時点で「実物ではない」ためで、
画面の挙動は Web の E2E（実ブラウザ + 実バンドル）が受け持つ。
これは ADR-0016 に記録する。

### 2.2 E2E テスト

E2E は **2 系統**に分ける。守る対象が違うためである。

| 系統 | ツール | 対象 | いつ動くか |
| --- | --- | --- | --- |
| Web | Playwright | `expo export` した実バンドル + 実 Supabase | **PR ごと**（マージ条件） |
| iOS ネイティブ | Maestro | 実機ビルド（`.app`）+ 実 Supabase | 手動 / 週次 |

Web を PR のゲートに据え、iOS をゲートから外すのは
**ランナーのコストと所要時間**が理由である（§5.4）。

## 3. E2E ツールの選定

### 3.1 結論

- **Web: Playwright**
- **iOS ネイティブ: Maestro**
- **Detox は採用しない**

決定の記録は [ADR-0014](./adr/0014-playwright-and-maestro-over-detox.md)。

### 3.2 なぜ Web を主戦場にできるのか

本プロジェクトは iOS が主戦場であり、一見すると「iOS の E2E こそ PR ゲートにすべき」に見える。
それでも Web を主にできるのは、次の 3 つが揃っているためである。

1. **同一コードベース**。`react-native-web` が同じコンポーネントツリーを DOM に写像するため、
   画面ロジック・状態管理・API アクセス層は Web と iOS で**同じコードが動く**。
2. **UI がモバイル幅専用**（[ADR-0005](./adr/0005-mobile-only-viewport.md)）。
   レイアウト分岐が存在しないので、幅 390px のブラウザで見えているものは
   iOS で見えるものとレイアウト上ほぼ同一になる。
3. **バックエンドが共通**。Edge Function・RLS・DeepSeek 連携はプラットフォームに依存しない。

したがって **iOS 固有として E2E で別途守る必要があるのは、`.native.ts` に分岐している箇所だけ**になる。
具体的には Apple / Google のネイティブサインイン、SecureStore によるセッション永続化、
カスタムスキームのディープリンクの 3 つ（[frontend-design.md](./frontend-design.md) §8〜§9）。
Maestro のフローはこの 3 つに絞る。

### 3.3 Detox を採用しない理由

| 観点 | Detox | 判断 |
| --- | --- | --- |
| テスト対象の同一性 | **グレーボックス**。ネイティブのテストライブラリをアプリバイナリにリンクする必要があり、テストするバイナリが出荷するバイナリと同一でない | 実物をテストするという本プロジェクトの方針と噛み合わない |
| Expo との相性 | `expo prebuild` + カスタム dev client のビルドが前提。`ios/` は `.gitignore` 済みで、CI で毎回生成することになる | セットアップと維持のコストが高い |
| Web | 非対応 | どのみち Web 用に別ツールが要る＝ツールが 2 つに増える点は Maestro と同じ |
| ネイティブのシステムダイアログ | Sign in with Apple のシートはアプリ外プロセスで表示されるため扱いづらい | **MVP の認証要件の中心**が扱いづらいのは致命的 |
| 実行環境 | iOS は macOS ランナー必須 | Maestro も同じ。差別化要因にならない |

**決め手は上 2 つ**。「実物に接続する」ことを重視して設計してきたプロジェクトで、
「実物ではないバイナリ」をテストするのは一貫性がない。

### 3.4 Maestro を選ぶ理由

- **ブラックボックス**。出荷するのと同じ `.app` をそのまま起動して操作する。
- フローが YAML で、JS のテストホストプロセスを React Native のバージョンに追従させる必要がない。
- ネイティブのシステムダイアログ（Apple のサインインシート、許可ダイアログ）を扱える。
- `testID` がそのまま accessibility identifier になるため、**Web の Playwright とセレクタを共有できる**（§4）。

### 3.5 Playwright を選ぶ理由

- Chromium を Linux ランナーで動かせる。macOS ランナーの **10 倍安く、桁違いに速い**。
- テスト対象が `expo export` の出力そのもので、**Vercel が配信するものと同一**。
- Service Worker の登録、`localStorage` のセッション永続化、レスポンスヘッダといった
  Web 固有の関心事をそのまま検証できる。

## 4. `testID` を単一のセレクタ源にする

Playwright と Maestro でセレクタを二重管理しない。**`testID` 1 つに寄せる。**

```
React Native の testID
   ├─ react-native-web  → DOM の data-testid 属性  → Playwright: getByTestId()
   └─ iOS               → accessibility identifier → Maestro: id: "..."
```

このため、E2E から触る要素には必ず `testID` を付ける。
**表示文言（日本語）でセレクタを書かない**。文言はコピー修正で頻繁に変わるうえ、
サーバーが返すエラーメッセージ（[api-spec.md](./api-spec.md) §2.4）はクライアントの管理外だからである。

命名規則は `<画面または部品>-<役割>` のケバブケース（`sign-in-submit`、`home-word-input`）。
一覧は `frontend/e2e/testIds.ts` に定数として集約し、Playwright 側はそれを import する。
Maestro の YAML からは import できないため文字列で書くが、同じファイルを参照先として
コメントに明記する。

## 5. GitHub Actions パイプライン構成

### 5.1 ワークフロー一覧

| ファイル | トリガー | 役割 | ランナー |
| --- | --- | --- | --- |
| `ci.yml` | `pull_request`, `push: main`, 日次 `schedule` | lint → typecheck → 単体 → ビルド → Web E2E | ubuntu |
| `deploy.yml` | `push: main`, 手動 | Supabase 適用 → **その後** Vercel 本番デプロイを起動 | ubuntu |
| `e2e-preview.yml` | `deployment_status`（Vercel のプレビュー成功） | プレビュー URL に対するスモーク | ubuntu |
| `e2e-ios.yml` | 手動, 週次 `schedule` | Maestro による iOS ネイティブ E2E | macOS |

### 5.2 `ci.yml` のジョブ構成

```
                    ┌─────────────┐
   pull_request ───▶│  frontend   │ lint / typecheck / unit / build:web
                    └──────┬──────┘   （dist を artifact として上げる）
                           │
                    ┌──────┴──────┐
                    │  e2e-web    │ dist を取得 → ローカル配信 → Playwright
                    └─────────────┘
   pull_request ───▶┌─────────────┐
                    │  backend    │ deno fmt --check / lint / check / test
                    └─────────────┘
```

- `frontend` と `backend` は**並列**。互いに依存しない（[ADR-0001](./adr/0001-monorepo-layout.md) の
  「独立してデプロイできる」構成がそのままテストにも効く）。
- `e2e-web` は `frontend` の成果物を再利用する。**E2E のためにビルドし直さない**。
  ビルド成果物が 1 つであることが、「テストしたものと配信するものが同じ」を保証する。

### 5.3 ビルドしたものをどう配信して E2E するか

`dist/` は静的ファイルなので、CI では**依存ゼロの Node スクリプト**（`frontend/e2e/serve-dist.mjs`）で配信する。
やることは 2 つだけ:

1. 実在するファイルはそのまま返す
2. 実在しないパスは `index.html` を返す（SPA フォールバック。`web.output: "single"` のため必須）

**`vercel.json` のヘッダやリライトをここで再現しない。** Vercel のルーティング構文を
自前で再実装すると本番と乖離するためで、`vercel.json` の設定が正しいかどうかは
実際の Vercel プレビューに対して `e2e-preview.yml` が検証する（§7）。役割分担は次のとおり。

| 何を守るか | どこで |
| --- | --- |
| アプリの挙動（認証・生成・履歴・バリデーション） | `ci.yml` の `e2e-web`（ローカル配信） |
| プラットフォーム設定（SPA フォールバック、セキュリティヘッダ、SW の配信ヘッダ） | `e2e-preview.yml`（実 Vercel） |

### 5.4 iOS を PR ゲートに入れない理由

- macOS ランナーは Linux の **10 倍**の従量単価。
- シミュレータ起動 + `expo prebuild` + Xcode ビルドで、1 回あたり十数分〜。
- 一方で iOS 固有の分岐は §3.2 のとおり 3 箇所しかなく、**PR ごとに壊れる種類のコードではない**
  （認証アダプタと永続化アダプタは頻繁に触らない）。

したがって週次 + 手動とし、**`frontend/src/**/*.native.ts` を触った PR では手動実行する**ことを
運用ルールにする。CI で強制はしない（強制すると fork PR で必ず落ちる）。

### 5.5 初回実行で判明した点

パイプラインを実際に動かして分かったこと。どちらも再発しやすいので記録しておく。

**(a) `expo run:ios` は対象を明示しないと実機向けにビルドする。**

```
CommandError: No code signing certificates are available to use.
```

コード署名証明書のない CI では必ず失敗する。`--device <udid>` でシミュレータを明示する。
ランナーのイメージ更新で機種名が変わるため、**名前を決め打ちせず
`xcrun simctl list devices available` から実際に選ぶ**（`e2e-ios.yml` の
`Select an iOS simulator` ステップ）。

**(b) 設定が未登録だと、E2E は全スペックが同じ理由でまとめて落ちる。**

`EXPO_PUBLIC_*` が空のままビルドすると、**ビルド自体は成功する**（`env.ts` の検証は
バンドル実行時に効くもので、ビルド時ではない）。しかし出来上がった `dist` は
起動時に `InvalidEnvError` を投げるため画面が出ず、
ネットワークを使わないスペックまで含めて全部が落ちる。
21 件の失敗ログを見ても原因にたどり着けない。

そのため `e2e-web` は**実行前に必要な設定の有無を確認し、
足りなければ 1 行のエラーで止める**。`frontend` ジョブ側は
（fork の PR では未設定が正常なので）失敗させず警告に留める。

**(c) プレビューが OpenOwl のビルドを配信していないと、スモークが全滅する。**

初回のプレビュースモークは 7 件すべてが、それぞれ別の理由で落ちた。

| スペック | 観測された値 |
| --- | --- |
| セキュリティヘッダ | `referrer-policy` が `origin-when-cross-origin`（Vercel の既定値。`vercel.json` の指定が効いていない） |
| `sw.js` のキャッシュ | `public, max-age=0, must-revalidate`（同上） |
| manifest | `200` だが本文が JSON ではなく HTML |
| バンドルの長期キャッシュ | ページ内に `/_expo/static/` を指す `<script>` が無い |

ローカルの `dist/` にはこれらが正しく存在する（`manifest.webmanifest` / `sw.js` /
`_expo/static/`、`index.html` は `/_expo/static/js/web/entry-*.js` を参照）。
つまり**成果物は正しく、配信されているものが別物**という状態である。

原因は Vercel のプロジェクト設定が §1.1 と食い違っていること
（Root Directory / Build Command / Output Directory）、
またはデプロイ保護が有効で保護ページが返っていること。**どちらもコードでは直せない。**

再発時に原因を読み取れるよう、スモークの**先頭に
「プレビューが OpenOwl のビルドを配信しているか」の判定を置く**。
これが落ちていたら、以降の失敗は追いかけるだけ無駄なので設定を先に直す。

### 6.1 前提: CI は本番プロジェクトに一切触らない

[deployment.md](./deployment.md) §2.1 の 2 プロジェクト構成をそのまま使う。

| プロジェクト | CI からの用途 |
| --- | --- |
| `openowl-test` | E2E の接続先。Vercel Preview の接続先 |
| `openowl-prod` | `deploy.yml` のマイグレーション / Function デプロイ**のみ** |

### 6.2 CI に DeepSeek のキーを置かない

[deployment.md](./deployment.md) の当初の環境変数マトリクスでは
`DEEPSEEK_API_KEY` を GitHub Actions Secrets に置く想定だったが、
**フェーズ 6 の設計では不要**であることが判明したため置かない。

理由: E2E はブラウザから Edge Function を叩き、DeepSeek は
**テスト用プロジェクトの Edge Function が自分の Secrets を使って**呼ぶ。
CI のプロセスが DeepSeek を直接叩く経路はどこにもない。
Function のデプロイにも DeepSeek のキーは要らない（Secrets は別系統で設定済み）。

漏洩面を減らせるので、置かないことをこの設計の一部として固定する。

### 6.3 テストユーザーは事前に手で作る

E2E はサインイン済みの状態を必要とするが、
**`service_role` キーを GitHub Actions に置くことは [security.md](./security.md) §2.2 が禁じている**。
したがって CI からユーザーを作成・削除しない。代わりに:

1. テスト用 Supabase プロジェクトに **E2E 専用アカウントを 1 つ手で作成**し、メール確認を済ませておく（人手が必要な作業）
2. その資格情報を GitHub Actions Secrets に置く
3. E2E は**通常のログイン画面から anon キーでサインインする**

これで CI が持つ権限は「1 人のふつうのユーザー」に等しくなり、
RLS がそのまま CI に対する権限境界として働く。`service_role` は登場しない。

### 6.4 テストデータの後始末

E2E が作るデータは当該ユーザーの `lookups` 行のみ。
**各スペックが自分で作った履歴を、自分の JWT で削除する**（画面の「削除」操作を使う）。
RLS の `lookups_delete_own` により自分の行だけが消せるので、
ここでも特権は要らない。

`terms` / `synonym_generations` は全ユーザー共有のキャッシュ（[ADR-0008](./adr/0008-global-generation-cache.md)）で
個人に紐付かないため、消さずに残す。むしろ残すことが §6.5 のコスト制御になる。

### 6.5 DeepSeek のコスト制御

**PR ごとに実 LLM を叩くと、PR 数に比例して課金される。** これを設計で抑える。

| 仕掛け | 効果 |
| --- | --- |
| E2E は**固定の単語**（`improve`）を使う | 初回だけ生成が走り、以降は `SYNONYM_CACHE_TTL_DAYS`（既定 30 日）の間キャッシュヒットで返る。UI の通し経路は同じなので、テストの価値は落ちない |
| 生成を伴わない検証を優先する | 入力バリデーション、認証ガード、[ADR-0012](./adr/0012-generation-as-mutation.md) の「URL 直接アクセスで再生成しない」は**トークンを 1 つも使わずに**検証できる |
| 実生成の経路は**日次 1 回だけ** | `ci.yml` の `schedule` 実行時のみ、日替わりの単語で `forceRefresh` を通す。キャッシュに頼らない経路が壊れていないことを毎日 1 回確認する |
| E2E ジョブを直列化する | 同時実行で同じアカウントのレート制限（`RATE_LIMIT_PER_HOUR`）を食い合わないようにする |

キャッシュヒットはレート制限を消費しない（[security.md](./security.md) §6）ため、
PR が集中しても上限に当たらない。

### 6.6 GitHub Actions の Variables と Secrets の使い分け

**公開前提の値を Secrets に入れない。** 入れるとログ中でマスクされ、
デバッグしづらくなるうえ「秘密である」という誤解を生む。
`EXPO_PUBLIC_*` はビルド時にバンドルへ埋め込まれ誰でも読める値（[security.md](./security.md) §2.2）なので、
**Variables** に置く。

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Variables | テスト用プロジェクトの URL。E2E 用ビルドに埋め込む |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Variables | 同上の anon キー。保護は RLS が担う |
| `SUPABASE_PROJECT_REF_PROD` | Variables | `deploy.yml` の対象プロジェクト |
| `E2E_USER_EMAIL` | **Secrets** | E2E 専用アカウント |
| `E2E_USER_PASSWORD` | **Secrets** | 同上 |
| `SUPABASE_ACCESS_TOKEN` | **Secrets** | Supabase CLI の認証 |
| `VERCEL_DEPLOY_HOOK_URL` | **Secrets** | 本番デプロイの起動（§7.2）。URL を知っている者は誰でもデプロイを起動できる |

`SUPABASE_SERVICE_ROLE_KEY` と `DEEPSEEK_API_KEY` は**どちらにも置かない**。

### 6.7 fork からの PR

**fork の PR には Secrets も Variables も渡らない。** これは GitHub の仕様であり、
回避策（`pull_request_target` の使用）は fork のコードを信頼済み文脈で走らせることになるため**採らない**。

したがって:

- fork PR では `frontend` / `backend` ジョブ（lint・typecheck・単体・ビルド）**のみ**が走る
- `e2e-web` は「PR の head が同一リポジトリであること」を条件にスキップする
- fork の変更に E2E を通したい場合は、メンテナがブランチを本リポジトリに取り込んでから走らせる

E2E ジョブは GitHub Environment（`e2e`）に紐付ける。
将来コントリビュータが増えたときに、承認を挟む運用へ設定だけで移行できるようにするため。

## 7. Vercel デプロイフロー

### 7.1 プレビュー

**Vercel の GitHub 連携に任せる。**追加のワークフローで `vercel deploy` を叩かない
（トークン管理が増えるだけで得るものがない）。

```
PR を開く / push
   └─▶ Vercel がプレビューをビルド（環境変数は Preview 用 = テスト用 Supabase）
          └─▶ GitHub に deployment_status(success) が飛ぶ
                 └─▶ e2e-preview.yml が environment_url に対してスモーク
```

スモークで見るのは**ローカル配信では見られないものだけ**（§5.3）:

- SPA フォールバックが効いている（`/history` に直接アクセスして 200 + アプリシェル）
- セキュリティヘッダが付いている（`X-Content-Type-Options` 等）
- `sw.js` が `no-store` で配信される
- `manifest.webmanifest` が取得できる
- 実際にサインインできる（プレビューがテスト用 Supabase を向いていることの確認）

**プレビューのスモークでは生成を行わない**（トークンを使わない）。

### 7.2 本番

ここには [deployment.md](./deployment.md) §4 の**順序制約**がある。

> 1. Supabase のマイグレーションを先に適用する
> 2. Edge Function をデプロイする
> 3. フロントエンドをデプロイする

Vercel の GitHub 連携を `main` に対して有効のままにすると、
**フロントエンドが先にデプロイされてこの順序が破れる**。自動化した結果として
ドキュメントに書いた制約を自ら破ることになるので、そうならないようにする。

```jsonc
// frontend/vercel.json
"git": { "deploymentEnabled": { "main": false } }
```

`main` への push で Vercel は動かなくなる。代わりに `deploy.yml` が順序どおりに進める。

```
push: main
   └─▶ deploy.yml
         job: supabase   （environment: production）
           1. supabase db push          … 未適用のマイグレーションを適用
           2. supabase functions deploy … Edge Function を更新
         job: frontend  (needs: supabase)
           3. Vercel Deploy Hook を POST … 本番ビルド開始
```

- **Deploy Hook を使い、Vercel CLI とトークンを使わない。**必要なのは「ビルドを開始させる」ことだけで、
  それには署名付き URL への POST で足りる。CLI を入れるとビルドが CI 側で走り、
  Vercel 側のビルドキャッシュと環境変数の解決経路が変わってしまう。
- `db push` と `functions deploy` は**毎回無条件に実行する**。どちらも冪等
  （未適用のマイグレーションが無ければ何もしない、同じ関数の再デプロイは無害）で、
  「backend に変更があったか」を CI で判定する仕組みを持たない方が壊れにくい。
  代償は main への push ごとに Function のバージョンが 1 つ増えることだが、実害がない。
- `environment: production` を付けてあるので、承認レビューを要求する設定に
  ダッシュボードから切り替えられる。

決定の記録は [ADR-0015](./adr/0015-production-deploy-gated-on-backend.md)。

### 7.3 ロールバック

- **フロントエンド**: Vercel ダッシュボードで以前のデプロイを Promote する。
  ただし [deployment.md](./deployment.md) §4 のとおり、Service Worker と CDN により
  旧版はしばらく生き残る前提で運用する。
- **バックエンド**: マイグレーションは**戻さない**（追記のみ）。
  問題があれば打ち消すマイグレーションを新しく足す。Edge Function は
  直前のコミットを `main` に積み直せば `deploy.yml` が再デプロイする。

## 8. ローカルでの実行

```bash
# --- backend ---
cd backend/supabase/functions
deno task test          # 単体テスト（純粋ロジックのみ）
deno task check         # fmt --check + lint + type check

# --- frontend ---
cd frontend
npm run test            # 単体テスト（Vitest / 純粋ロジックのみ）
npm run build:web       # dist/ を作る
npm run e2e             # Playwright（要 .env.local + E2E アカウント）
npm run e2e:ui          # 対話的に実行

# --- iOS ---
cd frontend
npx maestro test e2e/maestro/      # 要 シミュレータ + ビルド済みアプリ
```

E2E をローカルで動かすには、`frontend/.env.local` に加えて
E2E アカウントの資格情報が要る（`.env.local` に `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` を書く）。
`.env*` は `.gitignore` 済み。

## 9. 意図的にやらないこと

| やらないこと | 理由 |
| --- | --- |
| カバレッジ閾値の強制 | 単体テストの対象を純粋ロジックに限る設計なので、全体カバレッジは構造的に低くなる。閾値を置くと「数字を上げるためのテスト」を誘発する |
| ビジュアルリグレッションテスト | 画面数が少なく、モバイル幅固定でレイアウト分岐がない。スクリーンショット差分の維持コストに見合わない |
| Android の E2E | MVP のスコープ外（iOS と Web のみ） |
| 依存の自動更新（Dependabot 等） | Expo SDK は個別パッケージのバージョンが SDK と結び付いており、単体で上げると壊れる。SDK 単位で人が上げる |
| `pull_request_target` の使用 | fork のコードを信頼済み文脈で実行することになる（§6.7） |
