-- handle_new_user() は on_auth_user_created トリガーからのみ呼ばれる内部関数。
-- SECURITY DEFINER のため、Postgres の既定 GRANT により PUBLIC(= anon/authenticated)が
-- /rest/v1/rpc/handle_new_user 経由で直接実行できる状態になっていた(Supabase Advisor 指摘)。
-- トリガー実行は EXECUTE 権限とは無関係に行われるため、剥奪してもトリガーの動作には影響しない。
revoke execute on function public.handle_new_user() from public, anon, authenticated;
