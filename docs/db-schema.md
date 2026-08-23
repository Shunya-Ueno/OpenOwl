# DB スキーマ設計

対象: Supabase Postgres。すべて `public` スキーマに置く。
本ドキュメントは**設計**であり、実際のマイグレーションはフェーズ 3 で
`backend/supabase/migrations/` に作成する。

## 1. 設計方針

1. **ユーザー固有データと共有データを分離する。**
   「誰が何を検索したか」（`lookups`）はユーザー固有。
   「`improve` の類義語は何か」（`terms` / `synonym_generations` / `synonym_items`）は
   ユーザーに依存しない知識であり、全ユーザーで共有する。
   これにより同じ単語への 2 人目以降のリクエストで DeepSeek 呼び出しが不要になる
   （[ADR-0008](./adr/0008-global-generation-cache.md)）。

2. **`terms` を将来機能のアンカーにする。**
   例文生成・単語帳・発音などはすべて「ある単語について」の情報になる。
   `terms` を独立させておけば、将来機能は `terms` に FK を張るだけで済み、
   既存テーブルの変更が不要になる。

3. **先回りしてテーブルを作らない。**
   単語帳・例文生成・会話のテーブルは**作らない**。作るのは MVP に必要な 5 つのみ。
   唯一の例外は `lookups.kind` 列（後述）で、これは列 1 つのコストで
   将来の履歴統合を可能にするため。

4. **LLM の生成結果は正規化して保存する。**
   `synonym_items` として 1 語 1 行にする。JSONB 一括保存にしないのは、
   将来「この類義語を単語帳に保存する」という操作で個々の類義語に ID が必要になるため。

## 2. ER 図

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1:1"
    AUTH_USERS ||--o{ LOOKUPS : "検索した"
    TERMS ||--o{ LOOKUPS : "対象"
    TERMS ||--o{ SYNONYM_GENERATIONS : "生成された"
    SYNONYM_GENERATIONS ||--o{ SYNONYM_ITEMS : "含む"
    SYNONYM_GENERATIONS ||--o{ LOOKUPS : "参照された"

    AUTH_USERS {
        uuid id PK
        text email
    }
    PROFILES {
        uuid id PK_FK
        text display_name
        text native_language
        timestamptz created_at
        timestamptz updated_at
    }
    TERMS {
        uuid id PK
        text language
        text display_text
        text normalized_text
        timestamptz created_at
    }
    SYNONYM_GENERATIONS {
        uuid id PK
        uuid term_id FK
        text model
        text prompt_version
        smallint max_results
        int prompt_tokens
        int completion_tokens
        int cached_prompt_tokens
        int latency_ms
        timestamptz created_at
    }
    SYNONYM_ITEMS {
        uuid id PK
        uuid generation_id FK
        smallint position
        text synonym_text
        text part_of_speech
        text register
        text nuance
    }
    LOOKUPS {
        uuid id PK
        uuid user_id FK
        uuid term_id FK
        uuid generation_id FK
        lookup_kind kind
        boolean cache_hit
        timestamptz created_at
    }
```

`AUTH_USERS` は Supabase が管理する `auth.users`。アプリ側では直接触らない。

## 3. テーブル定義

### 3.1 `profiles`

`auth.users` と 1:1。アプリ固有のユーザー属性を持つ。
`auth.users` を直接 JOIN しないのは、Supabase の管理領域に依存しないため。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | ユーザー ID |
| `display_name` | `text` | NULL 可, 1〜50 文字 | 表示名 |
| `native_language` | `text` | NOT NULL, DEFAULT `'ja'` | 母語。ニュアンス説明の言語に使う |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | トリガーで更新 |

```sql
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text check (char_length(display_name) between 1 and 50),
  native_language text not null default 'ja' check (native_language ~ '^[a-z]{2}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

サインアップ時に自動作成する（クライアントに作成責務を持たせない）:

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''          -- search_path 汚染による権限昇格を防ぐ
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 3.2 `terms`

検索対象の語。**全ユーザー共有**で、ユーザー ID を持たない。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `language` | `text` | NOT NULL, DEFAULT `'en'`, `~ '^[a-z]{2}$'` | ISO 639-1。MVP は `en` 固定だが列は用意する |
| `display_text` | `text` | NOT NULL, 1〜64 文字 | 表示用。前後空白のみ除去した入力 |
| `normalized_text` | `text` | NOT NULL, 小文字であること | 一意性判定用のキー |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

```sql
create table public.terms (
  id              uuid primary key default gen_random_uuid(),
  language        text not null default 'en' check (language ~ '^[a-z]{2}$'),
  display_text    text not null check (char_length(display_text) between 1 and 64),
  normalized_text text not null check (
                    normalized_text = lower(normalized_text)
                    and char_length(normalized_text) between 1 and 64
                  ),
  created_at      timestamptz not null default now(),
  constraint terms_language_normalized_text_key unique (language, normalized_text)
);
```

**正規化ルール**（Edge Function 側の `Term` バリューオブジェクトが実装する）:
前後の空白を除去 → 連続空白を 1 つに圧縮 → 小文字化。
`Improve`、`improve `、`IMPROVE` はすべて同一の `terms` 行に解決される。

`citext` 拡張を使わず `normalized_text` 列を持つ理由: 正規化ルールが
「小文字化」以外にも及ぶ（空白の畳み込み）ため、DB の照合順序に任せると
アプリ側の解釈とずれる。正規化の責務をアプリ層に一本化する。

### 3.3 `synonym_generations`

DeepSeek への 1 回の生成呼び出しに対応する。**全ユーザー共有**（＝キャッシュの実体）。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `term_id` | `uuid` | NOT NULL, FK → `terms(id)` CASCADE | |
| `model` | `text` | NOT NULL | 例 `deepseek-chat` |
| `prompt_version` | `text` | NOT NULL | 例 `v1`。プロンプト変更時に上げる |
| `max_results` | `smallint` | NOT NULL, 1〜12 | 要求した件数 |
| `prompt_tokens` | `integer` | NULL 可 | 課金監視用 |
| `completion_tokens` | `integer` | NULL 可 | 課金監視用 |
| `cached_prompt_tokens` | `integer` | NULL 可 | DeepSeek のプロンプトキャッシュヒット分 |
| `latency_ms` | `integer` | NULL 可 | 上流レイテンシ |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | キャッシュ TTL の基準 |

```sql
create table public.synonym_generations (
  id                   uuid primary key default gen_random_uuid(),
  term_id              uuid not null references public.terms (id) on delete cascade,
  model                text not null,
  prompt_version       text not null,
  max_results          smallint not null check (max_results between 1 and 12),
  prompt_tokens        integer,
  completion_tokens    integer,
  cached_prompt_tokens integer,
  latency_ms           integer,
  created_at           timestamptz not null default now()
);

-- キャッシュ検索用。同一 term / model / prompt_version の最新行を引く
create index synonym_generations_cache_idx
  on public.synonym_generations (term_id, model, prompt_version, created_at desc);
```

**失敗した生成は保存しない。** 失敗はレスポンスと構造化ログで扱う。
DB に失敗行を積むと、キャッシュ検索のたびに成功行だけを選ぶ条件が必要になり、
テーブルも肥大化する。障害調査に必要な情報は Edge Function のログで足りる。

### 3.4 `synonym_items`

生成結果の 1 語 1 行。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 将来の単語帳が参照する ID |
| `generation_id` | `uuid` | NOT NULL, FK → `synonym_generations(id)` CASCADE | |
| `position` | `smallint` | NOT NULL, 0 以上 | 表示順（LLM が返した順＝近い順） |
| `synonym_text` | `text` | NOT NULL, 1〜64 文字 | 類義語 |
| `part_of_speech` | `text` | NULL 可, 列挙値 | `noun` / `verb` / `adjective` / `adverb` / `other` |
| `register` | `text` | NULL 可, 列挙値 | `formal` / `neutral` / `informal` |
| `nuance` | `text` | NULL 可, 〜200 文字 | 使い分けの短い説明（`profiles.native_language` の言語） |

```sql
create table public.synonym_items (
  id             uuid primary key default gen_random_uuid(),
  generation_id  uuid not null references public.synonym_generations (id) on delete cascade,
  position       smallint not null check (position >= 0),
  synonym_text   text not null check (char_length(synonym_text) between 1 and 64),
  part_of_speech text check (part_of_speech in ('noun','verb','adjective','adverb','other')),
  register       text check (register in ('formal','neutral','informal')),
  nuance         text check (char_length(nuance) <= 200),
  constraint synonym_items_generation_position_key unique (generation_id, position)
);

create index synonym_items_generation_idx
  on public.synonym_items (generation_id, position);
```

`part_of_speech` / `register` を Postgres の `enum` 型でなく
`text` + `CHECK` にしたのは、LLM 由来の値であり将来値が増える可能性が高く、
`CHECK` 制約の方が変更しやすいため（`enum` の値削除は不可）。

### 3.5 `lookups`

「ユーザーが単語を引いた」という**ユーザー固有の履歴**。RLS の主対象。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` CASCADE | |
| `term_id` | `uuid` | NOT NULL, FK → `terms(id)` CASCADE | |
| `generation_id` | `uuid` | NULL 可, FK → `synonym_generations(id)` ON DELETE SET NULL | 表示した生成結果 |
| `kind` | `lookup_kind` | NOT NULL, DEFAULT `'synonym'` | 将来の拡張点 |
| `cache_hit` | `boolean` | NOT NULL, DEFAULT `false` | 課金分析に使う（レート制限のカウント元には使わない。理由は §3.6） |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

```sql
create type public.lookup_kind as enum ('synonym');

create table public.lookups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  term_id       uuid not null references public.terms (id) on delete cascade,
  generation_id uuid references public.synonym_generations (id) on delete set null,
  kind          public.lookup_kind not null default 'synonym',
  cache_hit     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 履歴一覧（新しい順）
create index lookups_user_created_idx on public.lookups (user_id, created_at desc);

-- RLS の EXISTS 判定用
create index lookups_user_generation_idx on public.lookups (user_id, generation_id);

-- 課金分析用（課金が発生した呼び出しのみ）
create index lookups_rate_limit_idx on public.lookups (user_id, created_at desc)
  where cache_hit = false;
```

**`kind` 列について（唯一の先回り）**: 将来「例文生成」を追加したとき、
履歴テーブルを分けると「最近触った単語」を出すのに UNION が必要になる。
`enum` は `alter type ... add value 'example'` で拡張できるため、
列 1 つのコストで将来の統合を保証できる。MVP では値は `'synonym'` のみ。

**同じ単語を何度引いても行を追加する**（UPSERT しない）。
履歴は「イベントの記録」であり、頻度や時系列が将来の復習機能で意味を持つため。
画面表示では `distinct on (term_id)` で最新のみを出す。

### 3.6 `generation_attempts`

**レート制限専用の台帳。** `lookups` から独立させている。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` CASCADE | |
| `term_id` | `uuid` | NOT NULL, FK → `terms(id)` CASCADE | |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

```sql
create table public.generation_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  term_id    uuid not null references public.terms (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index generation_attempts_user_created_idx
  on public.generation_attempts (user_id, created_at desc);
```

**なぜ `lookups` を使わなかったか**: `lookups` は `lookups_delete_own` により
ユーザー自身が削除できる（履歴削除 UX。§4.3 参照）。レート制限のカウント元を
`lookups` にすると、履歴を消すだけで生成回数の上限がリセットできてしまう。
`generation_attempts` は **RLS を有効化した上で一切のポリシーを持たない**
（§4.1 の原則どおり、ポリシーがなければ全ロールから全操作が拒否される）。
書き込みは `service_role` が RPC（`record_generation_attempt`）経由でのみ行い、
クライアントから直接読み書きする経路は存在しない。

DeepSeek を実際に呼び出すたびに（成功時のみ）1 行追加する。`lookups` のような
表示用の情報（`generation_id` や `cache_hit`）は持たない。存在自体が
「呼び出しが発生した」という事実だけを表す。

## 4. RLS ポリシー設計

### 4.1 原則

- **全テーブルで RLS を有効化する。** ポリシーのないテーブルは全拒否になる。
- ポリシーには必ず `to authenticated` を付ける（未認証ロールに露出させない）。
- ポリシー内では `(select auth.uid())` と書く。
  行ごとの再評価を避け、InitPlan として 1 回だけ評価させるため（性能上の定石）。
- **書き込みは原則クライアントに開放しない。** 共有データ（`terms` / 生成結果）の
  書き込みは Edge Function の `service_role` のみ（`service_role` は RLS をバイパスする）。

### 4.2 テーブル別のアクセス方針

| テーブル | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | 本人のみ | 不可（トリガーで作成） | 本人のみ | 不可 |
| `terms` | **自分が引いたことのある語のみ** | 不可（Edge Function） | 不可 | 不可 |
| `synonym_generations` | **自分の `lookups` が参照する行のみ** | 不可（Edge Function） | 不可 | 不可 |
| `synonym_items` | 親の生成が可視な行のみ | 不可（Edge Function） | 不可 | 不可 |
| `lookups` | 本人のみ | 本人のみ | 不可 | 本人のみ（履歴削除 UX） |
| `generation_attempts` | 不可（誰からも） | 不可（Edge Function の RPC のみ） | 不可 | 不可 |

**共有データの SELECT をなぜ「全 authenticated に開放」しないのか**:
`terms` / 生成結果の中身は辞書的知識であり個人情報ではない。
しかし全開放すると「全ユーザーが検索した語の一覧」が取得可能になり、
これは集約すると利用傾向という別種の情報になる。
必要最小限（自分が引いた語）に絞っても実装コストは変わらないため、絞る。

### 4.3 ポリシー定義

```sql
alter table public.profiles            enable row level security;
alter table public.terms               enable row level security;
alter table public.synonym_generations enable row level security;
alter table public.synonym_items       enable row level security;
alter table public.lookups             enable row level security;

-- profiles ------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- lookups -------------------------------------------------------------
create policy "lookups_select_own" on public.lookups
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "lookups_insert_own" on public.lookups
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "lookups_delete_own" on public.lookups
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- terms ---------------------------------------------------------------
create policy "terms_select_looked_up" on public.terms
  for select to authenticated
  using (
    exists (
      select 1 from public.lookups l
      where l.term_id = terms.id
        and l.user_id = (select auth.uid())
    )
  );

-- synonym_generations -------------------------------------------------
create policy "synonym_generations_select_own_lookups" on public.synonym_generations
  for select to authenticated
  using (
    exists (
      select 1 from public.lookups l
      where l.generation_id = synonym_generations.id
        and l.user_id = (select auth.uid())
    )
  );

-- synonym_items -------------------------------------------------------
create policy "synonym_items_select_via_generation" on public.synonym_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.synonym_generations g
      join public.lookups l on l.generation_id = g.id
      where g.id = synonym_items.generation_id
        and l.user_id = (select auth.uid())
    )
  );
```

INSERT / UPDATE / DELETE ポリシーを書いていないテーブル・操作は**すべて拒否**される。
これは意図した設計であり、書き忘れではない。

### 4.4 `service_role` の扱い

Edge Function は `SUPABASE_SERVICE_ROLE_KEY` を使うクライアントで
`terms` / `synonym_generations` / `synonym_items` に書き込む。
`service_role` は RLS をバイパスするため、**このキーが漏れると全データが読める**。

対策:

- `service_role` キーは Edge Functions 実行環境にのみ存在させる（自動注入）。
  フロントエンド・Vercel・CI のいずれにも置かない。
- Edge Function 内では**用途で 2 つのクライアントを使い分ける**:
  - ユーザー文脈のクライアント（リクエストの `Authorization` を引き継ぐ）
    … ユーザーの本人確認、`lookups` の書き込み
  - `service_role` クライアント … 共有データの書き込みのみ
- 詳細は [`security.md`](./security.md)。

## 5. データベース関数（RPC）

Edge Function から呼ぶ。**複数行の挿入を 1 トランザクションにまとめるため**に必要。
PostgREST は複数リクエストをまたぐトランザクションを提供しないため、
「生成 + 明細 + 履歴」を原子的に書くには関数が必要になる。

| 関数 | 目的 |
| --- | --- |
| `find_or_create_term(language, display_text, normalized_text) → terms` | 語の解決。競合時も 1 行に収束させる |
| `find_latest_generation(term_id, model, prompt_version) → (id, created_at)` | term/model/prompt_version に対する最新の生成を返す（TTL 内外を問わない）。新鮮かどうかの判定は呼び出し側が行う |
| `save_synonym_generation(...) → uuid` | 生成 + 明細 + 履歴を原子的に保存 |
| `record_cached_lookup(user_id, term_id, generation_id) → uuid` | キャッシュヒット（TTL内・縮退応答の双方）時の履歴記録 |
| `record_generation_attempt(user_id, term_id) → uuid` | `generation_attempts` への記録。DeepSeek 呼び出しが成功した直後にのみ呼ぶ |
| `count_recent_generations(user_id, since) → integer` | レート制限のカウント。`generation_attempts` を参照する（§3.6） |
| `oldest_generation_attempt_at(user_id, since) → timestamptz` | 上限超過時、429 の `Retry-After` を正確に計算するために窓内で最も古い試行時刻を返す |

すべて `security definer` + `set search_path = ''` とし、
**`anon` / `authenticated` からの実行権限を剥奪する**（`service_role` のみ実行可）。

```sql
create function public.find_or_create_term(
  p_language text, p_display_text text, p_normalized_text text
) returns public.terms
language plpgsql security definer set search_path = ''
as $$
declare
  v_term public.terms;
begin
  loop
    select * into v_term from public.terms
    where language = p_language and normalized_text = p_normalized_text;

    if found then
      return v_term;
    end if;

    begin
      insert into public.terms (language, display_text, normalized_text)
      values (p_language, p_display_text, p_normalized_text)
      returning * into v_term;
      return v_term;
    exception when unique_violation then
      -- 同時実行で他のトランザクションが先に確定した。select からやり直す。
      null;
    end;
  end loop;
end;
$$;

revoke execute on function public.find_or_create_term(text, text, text) from anon, authenticated;
```

PostgreSQL 公式ドキュメントが upsert の競合対策として明示する
「`unique_violation` を捕捉してループする」パターンを使う。並行実行の安全性を
`ON CONFLICT DO NOTHING` のロック挙動という実装の暗黙の前提に置かず、
明示的な制御フローにするため。

`save_synonym_generation` は明細を `jsonb` 配列で受け取り、
生成行・明細行・`lookups` 行を 1 トランザクションで挿入して生成 ID を返す。
（実装はフェーズ 3。シグネチャは [`api-spec.md`](./api-spec.md) の永続化手順に対応する。）

## 6. 将来拡張時の追加イメージ（作らない）

参考として記録するのみ。**現時点では作成しない。**

| 機能 | 追加するもの | 既存への影響 |
| --- | --- | --- |
| 単語帳 | `vocabulary_entries(user_id, term_id, synonym_item_id, note, created_at)` | なし（FK を張るだけ） |
| 例文生成 | `example_generations(term_id, ...)` + `example_items` / `lookup_kind` に `'example'` 追加 | `alter type ... add value` のみ |
| 復習スケジュール | `vocabulary_entries` に SRS 用の列を追加 | なし |
| 会話 | `conversation_sessions` / `conversation_messages` | なし（独立） |
| 多言語 | `terms.language` に `en` 以外の値を入れる | なし（列は既にある） |
