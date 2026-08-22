-- get_advisors(security) の実行結果確認用に、PUBLIC からの明示的な revoke と
-- service_role への明示的な grant を追加しておく(念のための冗長化。
-- 20260822000200_functions.sql の revoke ... from anon, authenticated の時点で
-- 実質的には剥奪済みだったが、権限モデルを読んだだけで自明になるよう明示する)。

revoke execute on function public.find_or_create_term(text, text, text) from public;
grant execute on function public.find_or_create_term(text, text, text) to service_role;

revoke execute on function public.find_latest_generation(uuid, text, text) from public;
grant execute on function public.find_latest_generation(uuid, text, text) to service_role;

revoke execute on function public.save_synonym_generation(
  uuid, uuid, text, text, smallint, integer, integer, integer, integer, jsonb
) from public;
grant execute on function public.save_synonym_generation(
  uuid, uuid, text, text, smallint, integer, integer, integer, integer, jsonb
) to service_role;

revoke execute on function public.record_cached_lookup(uuid, uuid, uuid) from public;
grant execute on function public.record_cached_lookup(uuid, uuid, uuid) to service_role;

revoke execute on function public.count_recent_generations(uuid, timestamptz) from public;
grant execute on function public.count_recent_generations(uuid, timestamptz) to service_role;

-- トリガー関数は RPC として呼ばれる想定が無いため、同様に PUBLIC から剥奪する。
-- トリガー自体の発火には EXECUTE 権限は不要(所有者権限で実行されるため)。
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;
