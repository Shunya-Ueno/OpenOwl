-- 20260817120000_init_schema.sql の `revoke all ... from anon, authenticated` は
-- anon / authenticated 向けの既定権限を絞る意図だったが、対象に service_role が
-- 含まれていなかったため実害はなかった。一方で同じブロック以降、
-- profiles / words / synonym_generations / synonyms / search_history の5テーブルに対して
-- service_role への明示的な GRANT が一度も行われておらず、
-- service_role が持つのは Postgres がテーブル作成時に自動付与する
-- TRUNCATE / REFERENCES / TRIGGER のみだった(SELECT/INSERT/UPDATE/DELETE がない)。
--
-- generate-synonyms Edge Function は adminClient(service_role) 経由で
-- 単語の upsert・類義語の保存・レート制限のための search_history 参照/追記を行うため、
-- この権限不足により全リクエストが `permission denied for table ...` (42501) で失敗していた。
--
-- service_role は RLS を bypassrls 属性でバイパスするが、テーブルへの GRANT 自体は別軸であり
-- 自動では付与されない。ここで明示的に付与する。
grant select, insert, update, delete
  on public.profiles, public.words, public.synonym_generations,
     public.synonyms, public.search_history
  to service_role;
