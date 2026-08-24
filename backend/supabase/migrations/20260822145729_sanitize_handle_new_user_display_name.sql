-- code-review 指摘の修正: OAuth の full_name が 51 文字以上、または空文字/空白のみの
-- 場合、profiles.display_name の CHECK (1〜50文字) に違反して auth.users への INSERT
-- 自体が失敗し、サインアップができなくなっていた。50文字にトリムし、空になったら
-- NULL にする(display_name は NULL 許容)。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 50), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
