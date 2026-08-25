-- =============================================================
-- Fixed-window rate limiting in Postgres: atomic, shared across
-- serverless instances, no extra infrastructure. Keys are opaque
-- (route + user id); rows self-clean as windows roll over.
-- =============================================================

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
grant all on public.rate_limits to service_role;

create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_count int;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
    do update set count = rl.count + 1
  returning count into v_count;

  -- Opportunistic cleanup: old windows are dead weight.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end $$;
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
