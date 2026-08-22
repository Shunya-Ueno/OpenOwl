-- code-review 指摘の修正。
--
-- 1) レート制限を lookups から独立させる。lookups は lookups_delete_own により
--    ユーザーが削除できる(docs/api-spec.md 4.2 の意図した挙動)ため、
--    レート制限のカウント元に使うと「履歴を消せば上限がリセットされる」抜け道になる。
--    service_role のみが書き込め、DELETE ポリシーを一切持たない台帳を新設する。
create table public.generation_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  term_id    uuid not null references public.terms (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.generation_attempts is
  'DeepSeek を実際に呼び出した記録(レート制限専用の台帳)。削除ポリシーを持たない。';

alter table public.generation_attempts enable row level security;
-- 意図的に SELECT/INSERT/UPDATE/DELETE いずれのポリシーも作らない。
-- service_role のみが RPC 経由で書き込む(RLS をバイパスする)。

create index generation_attempts_user_created_idx
  on public.generation_attempts (user_id, created_at desc);

-- 2) レート制限用 RPC を lookups ではなく generation_attempts から数えるようにする。
create or replace function public.record_generation_attempt(
  p_user_id uuid, p_term_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.generation_attempts (user_id, term_id)
  values (p_user_id, p_term_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.record_generation_attempt(uuid, uuid) from public;
grant execute on function public.record_generation_attempt(uuid, uuid) to service_role;

create or replace function public.count_recent_generations(
  p_user_id uuid, p_since timestamptz
) returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.generation_attempts
  where user_id = p_user_id
    and created_at >= p_since;
$$;

-- 3) 429 の Retry-After を正確に計算するため、スライディングウィンドウ内で
--    最も古い試行時刻を返す RPC を追加する(上限超過時のみ呼ぶ)。
create function public.oldest_generation_attempt_at(
  p_user_id uuid, p_since timestamptz
) returns timestamptz
language sql
security definer
set search_path = ''
stable
as $$
  select min(created_at)
  from public.generation_attempts
  where user_id = p_user_id
    and created_at >= p_since;
$$;

revoke execute on function public.oldest_generation_attempt_at(uuid, timestamptz) from public;
grant execute on function public.oldest_generation_attempt_at(uuid, timestamptz) to service_role;

-- 4) save_synonym_generation: トークン数はプロバイダの usage が欠けることがあり
--    null を渡す必要がある。デフォルト null を付け、生成される TS 型を nullable にする。
create or replace function public.save_synonym_generation(
  p_term_id uuid,
  p_user_id uuid,
  p_model text,
  p_prompt_version text,
  p_max_results smallint,
  p_prompt_tokens integer default null,
  p_completion_tokens integer default null,
  p_cached_prompt_tokens integer default null,
  p_latency_ms integer default null,
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_generation_id uuid;
begin
  insert into public.synonym_generations (
    term_id, model, prompt_version, max_results,
    prompt_tokens, completion_tokens, cached_prompt_tokens, latency_ms
  ) values (
    p_term_id, p_model, p_prompt_version, p_max_results,
    p_prompt_tokens, p_completion_tokens, p_cached_prompt_tokens, p_latency_ms
  )
  returning id into v_generation_id;

  insert into public.synonym_items (
    generation_id, position, synonym_text, part_of_speech, register, nuance
  )
  select
    v_generation_id,
    (item.position)::smallint,
    item.synonym_text,
    item.part_of_speech,
    item.register,
    item.nuance
  from jsonb_to_recordset(p_items) as item(
    position smallint,
    synonym_text text,
    part_of_speech text,
    register text,
    nuance text
  );

  insert into public.lookups (user_id, term_id, generation_id, kind, cache_hit)
  values (p_user_id, p_term_id, v_generation_id, 'synonym', false);

  return v_generation_id;
end;
$$;

revoke execute on function public.save_synonym_generation(
  uuid, uuid, text, text, smallint, integer, integer, integer, integer, jsonb
) from public;
grant execute on function public.save_synonym_generation(
  uuid, uuid, text, text, smallint, integer, integer, integer, integer, jsonb
) to service_role;
