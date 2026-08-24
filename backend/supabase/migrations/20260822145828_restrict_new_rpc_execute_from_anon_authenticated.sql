-- pg_proc.proacl の直接確認により判明: 新規作成した関数には Supabase の
-- ALTER DEFAULT PRIVILEGES で anon/authenticated への明示的な EXECUTE 権限が
-- 自動付与される。revoke ... from public だけでは名前付きロールへの明示的な
-- GRANT は取り消せない(既存関数を CREATE OR REPLACE した場合はこの新規付与が
-- 発生しないため気づきにくい)。anon/authenticated から明示的に剥奪する。

revoke execute on function public.record_generation_attempt(uuid, uuid) from anon, authenticated;
revoke execute on function public.oldest_generation_attempt_at(uuid, timestamptz) from anon, authenticated;
