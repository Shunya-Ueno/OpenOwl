-- docs/db-schema.md 3章に対応。
-- profiles / terms / synonym_generations / synonym_items / lookups を作成する。

create type public.lookup_kind as enum ('synonym');

-- 3.1 profiles ----------------------------------------------------------
-- auth.users と 1:1。アプリ固有のユーザー属性のみを持つ。
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text check (char_length(display_name) between 1 and 50),
  native_language text not null default 'ja' check (native_language ~ '^[a-z]{2}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'auth.users の 1:1 拡張。docs/db-schema.md 3.1。';

-- サインアップ時にプロフィール行を自動作成する。
-- search_path を固定するのは security definer 関数への権限昇格攻撃を防ぐため
-- (docs/security.md 4.4)。
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3.2 terms --------------------------------------------------------------
-- 検索対象の語。全ユーザー共有でユーザー ID を持たない
-- (docs/adr/0008-global-generation-cache.md)。
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

comment on table public.terms is
  '検索対象の語。全ユーザー共有。docs/db-schema.md 3.2。';

-- 3.3 synonym_generations --------------------------------------------------
-- DeepSeek への 1 回の生成呼び出し。全ユーザー共有(キャッシュの実体)。
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

comment on table public.synonym_generations is
  '1回の DeepSeek 生成結果。全ユーザー共有。失敗した生成は保存しない。docs/db-schema.md 3.3。';

create index synonym_generations_cache_idx
  on public.synonym_generations (term_id, model, prompt_version, created_at desc);

-- 3.4 synonym_items --------------------------------------------------------
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

comment on table public.synonym_items is
  '生成結果の1語1行。docs/db-schema.md 3.4。';

create index synonym_items_generation_idx
  on public.synonym_items (generation_id, position);

-- 3.5 lookups ---------------------------------------------------------------
-- ユーザー固有の検索履歴。RLS の主対象。
create table public.lookups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  term_id       uuid not null references public.terms (id) on delete cascade,
  generation_id uuid references public.synonym_generations (id) on delete set null,
  kind          public.lookup_kind not null default 'synonym',
  cache_hit     boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.lookups is
  'ユーザーが単語を引いた記録。ユーザー固有。docs/db-schema.md 3.5。';

create index lookups_user_created_idx on public.lookups (user_id, created_at desc);
create index lookups_user_generation_idx on public.lookups (user_id, generation_id);
create index lookups_rate_limit_idx on public.lookups (user_id, created_at desc)
  where cache_hit = false;
