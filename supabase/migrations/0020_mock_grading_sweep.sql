-- =============================================================
-- Stuck-grading recovery: a worker that dies mid-batch used to
-- strand entries in 'grading' forever, blocking the paper's
-- Results Day. Claims are now stamped, so the heartbeat can
-- requeue anything held too long.
-- =============================================================

alter table public.mock_entries
  add column if not exists grading_started_at timestamptz;

create or replace function public.claim_mock_entries(batch int)
returns setof public.mock_entries
language sql security definer set search_path = public as $$
  update public.mock_entries
  set status = 'grading',
      grading_started_at = now()
  where id in (
    select id from public.mock_entries
    where status in ('submitted', 'late')
    order by submitted_at
    limit batch
    for update skip locked
  )
  returning *;
$$;
revoke all on function public.claim_mock_entries(int) from public, anon, authenticated;
