-- =============================================================
-- A ladder match is a race through the SAME questions, so the
-- question list is fixed on the match row when it is created.
-- =============================================================
alter table public.ladder_matches
  add column if not exists question_ids uuid[] not null default '{}';
