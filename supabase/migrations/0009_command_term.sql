-- =============================================================
-- Command term: the IB instructional verb a question asks for
-- ("Evaluate", "Describe", …). Free text so admins are not blocked
-- by a fixed enum when the IB revises its command term list.
-- =============================================================

alter table public.questions
  add column if not exists command_term text;

create index if not exists questions_command_term_idx
  on public.questions (command_term);
