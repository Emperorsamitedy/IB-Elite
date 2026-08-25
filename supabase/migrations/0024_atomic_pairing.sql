-- =============================================================
-- Atomic duel pairing: two concurrent polls could both "pair"
-- the same queued player into two matches. Claiming both queue
-- rows in one locked transaction makes exactly one pairing win.
-- =============================================================

create or replace function public.claim_duel_pair(
  p_user_a uuid,
  p_user_b uuid,
  p_subject uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_locked int;
begin
  -- SKIP LOCKED: a row already claimed by a concurrent pairing simply
  -- doesn't count, so that pairing attempt reports failure and retries.
  select count(*) into v_locked from (
    select user_id from public.duel_queue
    where subject_id = p_subject and user_id in (p_user_a, p_user_b)
    for update skip locked
  ) locked_rows;
  if v_locked < 2 then
    return false;
  end if;
  delete from public.duel_queue
  where subject_id = p_subject and user_id in (p_user_a, p_user_b);
  return true;
end $$;
revoke all on function public.claim_duel_pair(uuid, uuid, uuid) from public, anon, authenticated;
