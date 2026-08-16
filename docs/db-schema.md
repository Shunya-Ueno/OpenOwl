# データベーススキーマ

対象: Supabase Postgres（`public` スキーマ）。認証情報は Supabase が管理する `auth.users` に格納され、
アプリ側では直接触りません。

## ER 図

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1 (trigger で自動作成)"
    auth_users ||--o{ search_history : "検索した"
    words ||--o{ synonym_generations : "の生成結果"
    words ||--o{ search_history : "が検索された"
    synonym_generations ||--o{ synonyms : "が含む"
    synonym_generations ||--o{ search_history : "を返した"

    auth_users {
        uuid id PK
        text email
    }
    profiles {
        uuid id PK_FK
        text display_name
        text native_language
        text learning_language
        timestamptz created_at
        timestamptz updated_at
    }
    words {
        uuid id PK
        text language
        text text "正規化済み(小文字/trim)"
        timestamptz created_at
    }
    synonym_generations {
        uuid id PK
        uuid word_id FK
        text model
        text prompt_version
        text status "succeeded|failed"
        text error_code
        int prompt_tokens
        int completion_tokens
        int latency_ms
        timestamptz created_at
    }
    synonyms {
        uuid id PK
        uuid generation_id FK
        smallint sort_order
        text term
        text part_of_speech
        text definition
        text nuance
        timestamptz created_at
    }
    search_history {
        uuid id PK
        uuid user_id FK
        uuid word_id FK
        uuid generation_id FK
        text raw_input
        text outcome "generated|cache|failed"
        timestamptz created_at
    }
```

## テーブル定義

### `profiles` — ユーザープロフィール

`auth.users` の 1:1 拡張。学習言語などアプリ固有の属性を持ちます。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | ユーザー ID |
| `display_name` | `text` | 1〜50文字 | 表示名（任意） |
| `native_language` | `text` | NOT NULL, default `'ja'`, ISO 639-1 | 母語 |
| `learning_language` | `text` | NOT NULL, default `'en'`, ISO 639-1 | 学習言語 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | トリガーで更新 |

- ユーザー作成時に `auth.users` の AFTER INSERT トリガーで**自動生成**します。
  クライアントに作成責務を持たせると、作成漏れの行が発生して RLS の前提が崩れるためです。
- `native_language` / `learning_language` は MVP では既定値のまま使いますが、
  将来の多言語対応でスキーマ変更を伴わないよう、最初からカラムとして持ちます（カラム2本のコストは無視できる）。

### `words` — 単語辞書（ユーザー横断で共有）

検索対象になった単語を正規化して1行に集約します。ユーザーには紐づきません。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `language` | `text` | NOT NULL, default `'en'`, ISO 639-1 | 単語の言語 |
| `text` | `text` | NOT NULL, 1〜64文字, `text = btrim(lower(text))` | **正規化済み**の単語 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

- **UNIQUE (`language`, `text`)**。この一意制約がキャッシュのキーになります。
- CHECK 制約で「正規化済みであること」を DB レベルでも保証します。
  アプリ側の正規化漏れがそのまま重複行になるのを防ぐためです。
- ユーザーが実際に入力した文字列（`"Happy "` など）は `search_history.raw_input` に残します。

### `synonym_generations` — LLM 生成の実行記録

**1回の LLM 呼び出し = 1行**。成功・失敗の両方を記録します。ユーザー ID は持ちません。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `word_id` | `uuid` | NOT NULL, FK → `words(id)` ON DELETE CASCADE | |
| `model` | `text` | NOT NULL | 例: `gemini-2.5-flash-lite` |
| `prompt_version` | `text` | NOT NULL | 例: `v1`。プロンプト変更時にキャッシュを無効化する鍵 |
| `status` | `text` | NOT NULL, `in ('succeeded','failed')` | |
| `error_code` | `text` | `status='succeeded'` のとき NULL | 失敗理由（[`error-handling.md`](./error-handling.md) の分類） |
| `prompt_tokens` | `integer` | | Gemini の `usageMetadata` から記録。コスト分析用 |
| `completion_tokens` | `integer` | | 同上 |
| `latency_ms` | `integer` | | LLM 呼び出しの所要時間 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

- **なぜ `user_id` を持たないか**: このテーブルは全ユーザーで共有するキャッシュ本体であり、
  authenticated ロールに読み取りを開放します。ここに「誰が引いたか」を入れると、
  他人の検索行動が読める個人情報の漏洩になります。誰が引いたかは `search_history` 側だけに置きます。
- `status='failed'` の行も残します。失敗が特定の単語に偏っていないか（プロンプトの問題か入力の問題か）を
  後から判断できるようにするためです。トークン数の記録はコスト監視にそのまま使えます。

### `synonyms` — 生成された類義語

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `generation_id` | `uuid` | NOT NULL, FK → `synonym_generations(id)` ON DELETE CASCADE | |
| `sort_order` | `smallint` | NOT NULL, 1〜20, UNIQUE(`generation_id`,`sort_order`) | 表示順（LLM が返した順＝関連度順） |
| `term` | `text` | NOT NULL, 1〜64文字 | 類義語そのもの |
| `part_of_speech` | `text` | `in ('noun','verb','adjective','adverb','other')` | 品詞 |
| `definition` | `text` | 〜200文字 | 学習者向けの短い語義（日本語） |
| `nuance` | `text` | 〜200文字 | 元の単語との使い分け（日本語） |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

- 1類義語 = 1行として保持します（`jsonb` 1カラムにまとめない）。
  将来の単語帳が「この類義語を保存」という単位で参照するため → [ADR-0005](./adr/0005-relational-synonyms-over-jsonb.md)
- `term` に対する `words` への FK は**張りません**。類義語ごとに `words` 行を作ると、
  一度も検索されていない単語で辞書が膨らみます。必要になった時点で後から追加できる情報です（YAGNI）。

### `search_history` — ユーザーの検索履歴 兼 利用量記録

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | |
| `word_id` | `uuid` | NOT NULL, FK → `words(id)` ON DELETE CASCADE | |
| `generation_id` | `uuid` | FK → `synonym_generations(id)` ON DELETE SET NULL | 失敗時は NULL |
| `raw_input` | `text` | NOT NULL, 1〜64文字 | ユーザーが実際に入力した文字列 |
| `outcome` | `text` | NOT NULL, `in ('generated','cache','failed')` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

このテーブルは2つの役割を兼ねます。

1. **ユーザーに見せる検索履歴**（`outcome <> 'failed'` を表示）
2. **レート制限のカウント元**（`outcome in ('generated','failed')` = LLM を実際に呼んだ回数）

`outcome='cache'` は LLM を呼んでいないため、1日あたりの生成上限には数えません
（ただしバースト制御（毎分の上限）は全リクエストに適用します）。

> ⚠️ **`search_history` に DELETE を許可してはいけません。**
> ユーザーが履歴を削除できると、レート制限のカウントをリセットできてしまいます。
> MVP では履歴削除機能がないため DELETE ポリシーを作りません。
> 将来「履歴を削除」機能を追加する場合は、論理削除（`deleted_at`）にするか、
> 利用量カウントを別の追記専用テーブルに分離する必要があります。

## インデックス

| テーブル | インデックス | 目的 |
| --- | --- | --- |
| `words` | UNIQUE (`language`, `text`) | 単語の解決とキャッシュキー |
| `synonym_generations` | (`word_id`, `model`, `prompt_version`, `created_at` DESC) WHERE `status='succeeded'` | キャッシュ検索。部分インデックスで失敗行を除外 |
| `synonyms` | (`generation_id`, `sort_order`) | 生成結果の順序付き取得 |
| `search_history` | (`user_id`, `created_at` DESC) | 履歴表示 + レート制限の期間集計 |
| `search_history` | (`user_id`, `word_id`, `created_at` DESC) | 「この単語を前にも引いたか」の判定（将来の単語帳で使用） |

すべての FK には、参照元テーブル側でインデックスが張られている状態を保ちます
（Postgres は FK に自動でインデックスを作らないため、`on delete cascade` が全表走査になるのを防ぐ）。

## DDL（Phase 3 で `backend/supabase/migrations/` に配置する内容）

> このコードブロックは**設計であり、まだリポジトリには配置していません**。
> Phase 3 でマイグレーションファイルとして起こします。

```sql
-- =============================================
-- 共通: updated_at 自動更新
-- =============================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================
-- profiles
-- =============================================
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text check (char_length(display_name) between 1 and 50),
  native_language   text not null default 'ja' check (native_language ~ '^[a-z]{2}$'),
  learning_language text not null default 'en' check (learning_language ~ '^[a-z]{2}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- auth.users への INSERT で profiles を自動生成する
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 50), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- words
-- =============================================
create table public.words (
  id         uuid primary key default gen_random_uuid(),
  language   text not null default 'en' check (language ~ '^[a-z]{2}$'),
  text       text not null
             check (text = btrim(lower(text)) and char_length(text) between 1 and 64),
  created_at timestamptz not null default now(),
  constraint words_language_text_key unique (language, text)
);

-- =============================================
-- synonym_generations
-- =============================================
create table public.synonym_generations (
  id                uuid primary key default gen_random_uuid(),
  word_id           uuid not null references public.words(id) on delete cascade,
  model             text not null,
  prompt_version    text not null,
  status            text not null check (status in ('succeeded', 'failed')),
  error_code        text,
  prompt_tokens     integer check (prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens >= 0),
  latency_ms        integer check (latency_ms >= 0),
  created_at        timestamptz not null default now(),
  constraint synonym_generations_error_code_check
    check (status <> 'succeeded' or error_code is null)
);

create index synonym_generations_cache_idx
  on public.synonym_generations (word_id, model, prompt_version, created_at desc)
  where status = 'succeeded';

-- =============================================
-- synonyms
-- =============================================
create table public.synonyms (
  id             uuid primary key default gen_random_uuid(),
  generation_id  uuid not null references public.synonym_generations(id) on delete cascade,
  sort_order     smallint not null check (sort_order between 1 and 20),
  term           text not null check (char_length(term) between 1 and 64),
  part_of_speech text check (part_of_speech in ('noun','verb','adjective','adverb','other')),
  definition     text check (char_length(definition) <= 200),
  nuance         text check (char_length(nuance) <= 200),
  created_at     timestamptz not null default now(),
  constraint synonyms_generation_order_key unique (generation_id, sort_order)
);

-- =============================================
-- search_history
-- =============================================
create table public.search_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  word_id       uuid not null references public.words(id) on delete cascade,
  generation_id uuid references public.synonym_generations(id) on delete set null,
  raw_input     text not null check (char_length(raw_input) between 1 and 64),
  outcome       text not null check (outcome in ('generated', 'cache', 'failed')),
  created_at    timestamptz not null default now()
);

create index search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

create index search_history_user_word_idx
  on public.search_history (user_id, word_id, created_at desc);
```

RLS の有効化とポリシー定義は [`security.md`](./security.md#rls-ポリシー設計) にまとめてあります
（同じマイグレーション内に含めます）。

### 生成結果を原子的に保存する RPC

Edge Function から PostgREST 経由で複数テーブルに書き込むと、
呼び出しごとに別トランザクションになります。途中で失敗すると
**「類義語が0件の生成記録」がキャッシュとして残り、以後その単語は空の結果を返し続けます**。
これを避けるため、書き込みは1つの関数にまとめて呼びます。

```sql
create or replace function public.record_synonym_generation(
  p_user_id           uuid,
  p_word_id           uuid,
  p_raw_input         text,
  p_model             text,
  p_prompt_version    text,
  p_prompt_tokens     integer,
  p_completion_tokens integer,
  p_latency_ms        integer,
  p_synonyms          jsonb   -- [{ "term":…, "partOfSpeech":…, "definition":…, "nuance":… }, …]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_generation_id uuid;
begin
  if jsonb_array_length(p_synonyms) = 0 then
    raise exception 'synonyms must not be empty';
  end if;

  insert into public.synonym_generations
    (word_id, model, prompt_version, status, prompt_tokens, completion_tokens, latency_ms)
  values
    (p_word_id, p_model, p_prompt_version, 'succeeded',
     p_prompt_tokens, p_completion_tokens, p_latency_ms)
  returning id into v_generation_id;

  insert into public.synonyms
    (generation_id, sort_order, term, part_of_speech, definition, nuance)
  select
    v_generation_id,
    (ordinal)::smallint,
    item ->> 'term',
    item ->> 'partOfSpeech',
    item ->> 'definition',
    item ->> 'nuance'
  from jsonb_array_elements(p_synonyms) with ordinality as t(item, ordinal);

  insert into public.search_history
    (user_id, word_id, generation_id, raw_input, outcome)
  values
    (p_user_id, p_word_id, v_generation_id, p_raw_input, 'generated');

  return v_generation_id;
end;
$$;

revoke all on function public.record_synonym_generation(
  uuid, uuid, text, text, text, integer, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.record_synonym_generation(
  uuid, uuid, text, text, text, integer, integer, integer, jsonb) to service_role;
```

- `security definer` かつ `search_path = ''`（スキーマを完全修飾）。
  実行権限は **`service_role` のみ**に絞り、クライアントからは呼べないようにします。
- 空配列を拒否することで、空のキャッシュ行が生まれる経路を DB 側でも塞ぎます。
- キャッシュヒット時と失敗時の `search_history` への記録は単一 INSERT なので、RPC を使わず直接書き込みます。

## 型の選び方についての方針

- **`enum` 型を使わず `text` + CHECK 制約**にしています。
  Postgres の enum は値の追加は容易でも削除・並べ替えができず、
  マイグレーションでの取り回しが悪いためです。`status` や `outcome` は将来値が増える可能性があります。
- **主キーは `uuid`**（`gen_random_uuid()`）。クライアントに連番 ID を露出させず、
  将来のオフライン生成・マージにも耐えるためです。
- **すべての時刻は `timestamptz`**。端末のタイムゾーンに依存させません。

## 将来拡張の受け皿

以下は**今回作りません**。既存スキーマが将来の追加を阻害しないことの確認のみ行います。

| 将来機能 | 追加テーブル（案） | 既存への変更 |
| --- | --- | --- |
| 単語帳 | `vocabulary_entries (id, user_id, word_id, synonym_id?, note, mastery_level, created_at)` | **なし**。`words` / `synonyms` を参照するだけ |
| 例文生成 | `example_sentences (id, word_id, generation_id, text, translation, ...)` | **なし**。`synonym_generations` と同じ構造の生成記録を別テーブルで持つ |
| ロールプレイ会話 | `conversation_sessions` / `conversation_messages` | **なし** |
| 復習スケジュール | `review_schedules (vocabulary_entry_id, due_at, interval_days)` | なし |

`synonyms` を1行1レコードにしてあるため、単語帳が「特定の類義語」を FK で指せます。
`jsonb` 1カラムに詰めていた場合、ここで正規化のためのマイグレーションが必要になっていました。
