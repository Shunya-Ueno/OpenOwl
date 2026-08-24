-- code-review 指摘の修正。
-- 元の実装(insert ... on conflict do nothing + フォールバック select)は
-- 理論上は ON CONFLICT のロック待ちで安全なはずだが、その保証を実装の細部
-- (ロック挙動)に依存させず、PostgreSQL 公式ドキュメントが upsert の競合対策
-- として明示する「unique_violation を捕捉してループする」パターンに置き換える。
-- これにより並行実行の安全性が実装の暗黙の前提ではなく明示的な制御フローになる。
-- https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-UPSERT-EXAMPLE

create or replace function public.find_or_create_term(
  p_language text, p_display_text text, p_normalized_text text
) returns public.terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term public.terms;
begin
  loop
    select * into v_term from public.terms
    where language = p_language and normalized_text = p_normalized_text;

    if found then
      return v_term;
    end if;

    begin
      insert into public.terms (language, display_text, normalized_text)
      values (p_language, p_display_text, p_normalized_text)
      returning * into v_term;
      return v_term;
    exception when unique_violation then
      -- 同時実行で他のトランザクションが先に確定した。ループして select からやり直す。
      null;
    end;
  end loop;
end;
$$;
