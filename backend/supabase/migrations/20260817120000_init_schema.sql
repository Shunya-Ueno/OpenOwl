-- OpenOwl 初期スキーマ
-- 設計根拠: docs/db-schema.md, docs/security.md
--
-- 構成:
--   1. 共通関数(updated_at 自動更新)
--   2. profiles (auth.users の 1:1 拡張)
--   3. words (単語辞書。ユーザー横断で共有)
--   4. synonym_generations (LLM 生成の実行記録。user_id を持たない)
--   5. synonyms (生成された類義語。1件1行)
--   6. search_history (ユーザーの検索履歴 兼 利用量記録)
--   7. RLS の有効化・権限・ポリシー
--   8. record_synonym_generation RPC (原子的な書き込み)

-- =============================================
-- 1. 共通: updated_at 自動更新
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
-- 2. profiles
-- =============================================
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text check (char_length(display_name) between 1 and 50),
  native_language   text not null default 'ja' check (native_language ~ '^[a-z]{2}$'),
  learning_language text not null default 'en' check (learning_language ~ '^[a-z]{2}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'auth.users の 1:1 拡張。学習言語などアプリ固有の属性を持つ。';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- auth.users への INSERT で profiles を自動生成する。
-- クライアントに作成責務を持たせると、作成漏れの行が発生し RLS の前提が崩れるため。
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
-- 3. words
-- =============================================
create table public.words (
  id         uuid primary key default gen_random_uuid(),
  language   text not null default 'en' check (language ~ '^[a-z]{2}$'),
  text       text not null
             check (text = btrim(lower(text)) and char_length(text) between 1 and 64),
  created_at timestamptz not null default now(),
  constraint words_language_text_key unique (language, text)
);

comment on table public.words is '検索対象になった単語を正規化して集約する辞書。ユーザーには紐づかない。';

-- =============================================
-- 4. synonym_generations
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

comment on table public.synonym_generations is
  '1回のLLM呼び出し=1行。成功・失敗の両方を記録する。個人情報を含まないため user_id は持たない。';

create index synonym_generations_cache_idx
  on public.synonym_generations (word_id, model, prompt_version, created_at desc)
  where status = 'succeeded';

-- =============================================
-- 5. synonyms
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

comment on table public.synonyms is '生成された類義語。1類義語=1行(jsonb にまとめない。理由: docs/adr/0005)。';

create index synonyms_generation_sort_idx
  on public.synonyms (generation_id, sort_order);

-- =============================================
-- 6. search_history
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

comment on table public.search_history is
  'ユーザーの検索履歴 兼 レート制限のカウント元。DELETE ポリシーは意図的に作らない(クォータ回避防止)。';

create index search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

create index search_history_user_word_idx
  on public.search_history (user_id, word_id, created_at desc);

-- =============================================
-- 7. RLS 有効化・権限・ポリシー
-- =============================================
alter table public.profiles            enable row level security;
alter table public.words               enable row level security;
alter table public.synonym_generations enable row level security;
alter table public.synonyms            enable row level security;
alter table public.search_history      enable row level security;

-- Supabase の既定 GRANT を明示的に絞ってから、必要な権限だけを与え直す。
revoke all on public.profiles, public.words, public.synonym_generations,
              public.synonyms, public.search_history
  from anon, authenticated;

grant select         on public.words               to authenticated;
grant select         on public.synonym_generations to authenticated;
grant select         on public.synonyms            to authenticated;
grant select         on public.search_history      to authenticated;
grant select, update on public.profiles            to authenticated;

-- profiles: 自分の行のみ。INSERT/DELETE ポリシーは意図的に作らない
-- (作成は handle_new_user トリガー、削除は auth.users の cascade)。
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 辞書データ: 個人情報を含まないため認証済みユーザー全員に読み取りを開放する。
-- 書き込みポリシーは意図的に作らない(Edge Function が service_role で書く)。
create policy "words_select_authenticated" on public.words
  for select to authenticated using (true);

create policy "synonym_generations_select_authenticated" on public.synonym_generations
  for select to authenticated using (true);

create policy "synonyms_select_authenticated" on public.synonyms
  for select to authenticated using (true);

-- search_history: 自分の履歴の読み取りのみ。INSERT/UPDATE/DELETE ポリシーは意図的に作らない。
create policy "search_history_select_own" on public.search_history
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- =============================================
-- 8. 生成結果を原子的に保存する RPC
-- =============================================
-- Edge Function から複数テーブルへの書き込みを1トランザクションにまとめる。
-- これがないと、途中失敗時に「類義語0件の生成記録」がキャッシュとして残り、
-- 以後その単語は空の結果を返し続ける(docs/adr/0005 参照)。
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
