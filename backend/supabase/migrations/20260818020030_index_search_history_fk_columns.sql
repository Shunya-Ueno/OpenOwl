-- search_history.word_id / generation_id を先頭列に持つインデックスがなかった。
-- 既存の複合インデックス(user_id, word_id, ...)は word_id が先頭列でないため、
-- words / synonym_generations 側の ON DELETE CASCADE / SET NULL がこれらの列を
-- 全表走査で探すことになる(db-schema.md の「FKには参照元でインデックスを張る」原則に反する)。
-- Supabase Advisor(performance)の unindexed_foreign_keys 指摘にも合致。
create index search_history_word_id_idx
  on public.search_history (word_id);

create index search_history_generation_id_idx
  on public.search_history (generation_id);
