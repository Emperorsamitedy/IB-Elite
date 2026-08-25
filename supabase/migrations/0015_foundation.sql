-- =============================================================
-- Competitive-system foundation: public display names, feature
-- flags, the immutable performance-event ledger, integrity
-- review queue, and in-app notifications.
-- =============================================================

-- ---------- public display names ----------
-- The user base is minors: real names must never appear on public
-- surfaces (leaderboards, duels, school pages). Every profile gets a
-- pseudonymous display name; the student can change it in settings.
alter table public.profiles
  add column if not exists display_name text;

update public.profiles
  set display_name = 'Student-' || substr(id::text, 1, 8)
  where display_name is null;

alter table public.profiles
  alter column display_name set not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    'Student-' || substr(new.id::text, 1, 8)
  ) on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, status) values (new.id, 'free')
  on conflict (user_id) do nothing;

  return new;
end $$;

-- ---------- feature flags ----------
-- Server-checked rollout switches for the competitive pillars.
create table public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
create policy "app_flags: public read" on public.app_flags
  for select using (true);
grant select on public.app_flags to anon, authenticated;
grant all on public.app_flags to service_role;

insert into public.app_flags (key, enabled) values
  ('ranked_duels', true),
  ('world_mock', false),
  ('school_wars', false),
  ('signal', false),
  ('scout_portal', false);

-- ---------- immutable performance ledger ----------
-- Every rated performance lands here, append-only. Ratings (Elo,
-- Signal, school scores) are derived from this ledger and can be
-- recomputed under any algorithm version.
create table public.performance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  kind text not null check (kind in (
    'duel_answer', 'duel_result', 'mock_result', 'practice_result'
  )),
  payload jsonb not null default '{}',
  integrity_flags jsonb not null default '[]',
  quarantined boolean not null default false,
  created_at timestamptz not null default now()
);
create index performance_events_user_idx
  on public.performance_events (user_id, subject_id, kind, created_at desc);
alter table public.performance_events enable row level security;
create policy "performance_events: self read" on public.performance_events
  for select using (auth.uid() = user_id);
grant select on public.performance_events to authenticated;
-- Deliberately no insert/update/delete grants below service_role: the
-- ledger is written by the server only and never mutated.
grant all on public.performance_events to service_role;

create table public.rating_algorithm_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (name, version)
);
grant all on public.rating_algorithm_versions to service_role;

insert into public.rating_algorithm_versions (name, version, config) values
  ('duel_elo', 1, '{"k": 32, "initial": 1200, "soft_reset_anchor": 1200}');

-- ---------- integrity review queue ----------
create table public.integrity_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind in ('duel_match', 'mock_entry', 'scan')),
  source_id uuid not null,
  reason text not null,
  details jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'cleared', 'upheld')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
create index integrity_reviews_status_idx on public.integrity_reviews (status, created_at);
alter table public.integrity_reviews enable row level security;
create policy "integrity_reviews: admin read" on public.integrity_reviews
  for select using (public.is_admin());
grant select on public.integrity_reviews to authenticated;
grant all on public.integrity_reviews to service_role;

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'duels', 'mock', 'school', 'season', 'system'
  )),
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: self read" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: self mark read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Per-category opt-out: a row means "opted out" so the default is on.
create table public.notification_optouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  primary key (user_id, category)
);
alter table public.notification_optouts enable row level security;
create policy "notification_optouts: self all" on public.notification_optouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, delete on public.notification_optouts to authenticated;
grant all on public.notification_optouts to service_role;
