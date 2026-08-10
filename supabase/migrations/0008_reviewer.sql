-- =============================================================
-- "Verified by" attribution: who reviewed a question, and when.
-- =============================================================
alter table public.questions
  add column if not exists reviewer_name text,
  add column if not exists reviewer_credential text,
  add column if not exists reviewed_at timestamptz;
