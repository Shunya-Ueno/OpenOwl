-- docs/db-schema.md 5章に対応。
-- Edge Function から呼ぶ RPC。複数テーブルへの書き込みを 1 トランザクションに
-- まとめるために存在する(PostgREST は複数リクエストをまたぐトランザクションを
-- 提供しないため)。すべて security definer + search_path 固定とし、
-- anon / authenticated からの実行権限を剥奪する(service_role のみ実行可)。

-- find_or_create_term: 語の解決。競合時も 1 行に収束させる。
create function public.find_or_create_term(
  p_language text, p_display_text text, p_normalized_text text
) returns public.terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term public.terms;
begin
  insert into public.terms (language, display_text, normalized_text)
  values (p_language, p_display_text, p_normalized_text)
  on conflict (language, normalized_text) do nothing
  returning * into v_term;

  if v_term.id is null then           -- 同時実行で他が先に入れた場合
    select * into v_term from public.terms
    where language = p_language and normalized_text = p_normalized_text;
  end if;

  return v_term;
end;
$$;

revoke execute on function public.find_or_create_term(text, text, text) from anon, authenticated;

-- find_latest_generation: term/model/prompt_version に対する最新の生成を返す。
-- TTL 判定は呼び出し側(GenerateSynonymsUseCase)が created_at を見て行う。
-- キャッシュヒット判定と縮退応答(TTL切れ)判定の両方をこの 1 関数で賄う。
create function public.find_latest_generation(
  p_term_id uuid, p_model text, p_prompt_version text
) returns table (id uuid, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select g.id, g.created_at
  from public.synonym_generations g
  where g.term_id = p_term_id
    and g.model = p_model
    and g.prompt_version = p_prompt_version
  order by g.created_at desc
  limit 1;
$$;

revoke execute on function public.find_latest_generation(uuid, text, text) from anon, authenticated;

-- save_synonym_generation: 生成 + 明細 + 履歴を 1 トランザクションで保存する。
-- p_items は [{ "position": 0, "synonym_text": "...", "part_of_speech": "...",
--              "register": "...", "nuance": "..." }, ...] の形の jsonb 配列。
create function public.save_synonym_generation(
  p_term_id uuid,
  p_user_id uuid,
  p_model text,
  p_prompt_version text,
  p_max_results smallint,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_cached_prompt_tokens integer,
  p_latency_ms integer,
  p_items jsonb
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
) from anon, authenticated;

-- record_cached_lookup: キャッシュヒット(TTL内・TTL切れの縮退応答の双方)時の履歴記録。
create function public.record_cached_lookup(
  p_user_id uuid, p_term_id uuid, p_generation_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.lookups (user_id, term_id, generation_id, kind, cache_hit)
  values (p_user_id, p_term_id, p_generation_id, 'synonym', true)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.record_cached_lookup(uuid, uuid, uuid) from anon, authenticated;

-- count_recent_generations: レート制限用。DeepSeek を実際に呼んだ回数のみを数える
-- (cache_hit = false)。キャッシュヒットは上限を消費しない(docs/api-spec.md 3.3)。
create function public.count_recent_generations(
  p_user_id uuid, p_since timestamptz
) returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.lookups
  where user_id = p_user_id
    and cache_hit = false
    and created_at >= p_since;
$$;

revoke execute on function public.count_recent_generations(uuid, timestamptz) from anon, authenticated;
