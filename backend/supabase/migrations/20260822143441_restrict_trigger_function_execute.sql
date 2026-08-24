-- Supabase は public スキーマの関数作成時に ALTER DEFAULT PRIVILEGES で
-- anon/authenticated/service_role へ実行権限を自動付与する。トリガー専用関数
-- (handle_new_user / set_updated_at)は RPC として呼ぶ必要がないため、
-- 明示的に anon/authenticated から剥奪する。

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
