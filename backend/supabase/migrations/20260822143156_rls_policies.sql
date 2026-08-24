-- docs/db-schema.md 4章に対応。
-- 全テーブルで RLS を有効化する。ポリシーのないテーブル・操作は全拒否になる
-- (これは意図した設計であり書き忘れではない。docs/security.md 4.2)。

alter table public.profiles            enable row level security;
alter table public.terms               enable row level security;
alter table public.synonym_generations enable row level security;
alter table public.synonym_items       enable row level security;
alter table public.lookups             enable row level security;

-- profiles ------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- lookups -------------------------------------------------------------
create policy "lookups_select_own" on public.lookups
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "lookups_insert_own" on public.lookups
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "lookups_delete_own" on public.lookups
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- terms -----------------------------------------------------------------
-- 全開放にしないのは、集約すると「全ユーザーの検索傾向」になるため。
-- 自分が引いたことのある語のみ閲覧可能にする。docs/adr/0008 参照。
create policy "terms_select_looked_up" on public.terms
  for select to authenticated
  using (
    exists (
      select 1 from public.lookups l
      where l.term_id = terms.id
        and l.user_id = (select auth.uid())
    )
  );

-- synonym_generations -----------------------------------------------------
create policy "synonym_generations_select_own_lookups" on public.synonym_generations
  for select to authenticated
  using (
    exists (
      select 1 from public.lookups l
      where l.generation_id = synonym_generations.id
        and l.user_id = (select auth.uid())
    )
  );

-- synonym_items -------------------------------------------------------------
create policy "synonym_items_select_via_generation" on public.synonym_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.synonym_generations g
      join public.lookups l on l.generation_id = g.id
      where g.id = synonym_items.generation_id
        and l.user_id = (select auth.uid())
    )
  );

-- INSERT / UPDATE / DELETE ポリシーを書いていないテーブル・操作はすべて拒否される。
-- terms / synonym_generations / synonym_items への書き込みは service_role
-- (Edge Function) のみが security definer 関数経由で行う。
