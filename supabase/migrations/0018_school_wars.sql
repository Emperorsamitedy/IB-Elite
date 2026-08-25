-- =============================================================
-- School Wars: opt-in school affiliation, participation-weighted
-- seasonal school scores, public ladders, and Rivalry Weeks.
-- =============================================================

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  -- Regional teams ("Team Ethiopia") catch students without a listed school.
  kind text not null default 'school' check (kind in ('school', 'regional')),
  crest_emoji text not null default '🏫',
  color text not null default '#e4572e',
  verified boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index schools_country_idx on public.schools (country, city);
alter table public.schools enable row level security;
create policy "schools: public read" on public.schools for select using (true);
grant select on public.schools to anon, authenticated;
grant all on public.schools to service_role;

-- Light verification: students request; admins approve into a real school.
create table public.school_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text check (country ~ '^[A-Z]{2}$'),
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  school_id uuid references public.schools(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.school_requests enable row level security;
create policy "school_requests: own read" on public.school_requests
  for select using (auth.uid() = requested_by or public.is_admin());
grant select on public.school_requests to authenticated;
grant all on public.school_requests to service_role;

-- Affiliation is opt-in and single: one school per student.
create table public.school_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index school_members_school_idx on public.school_members (school_id);
alter table public.school_members enable row level security;
create policy "school_members: public read" on public.school_members
  for select using (true);
grant select on public.school_members to anon, authenticated;
grant all on public.school_members to service_role;

-- Recomputed each heartbeat from performance_events; never client-written.
create table public.school_scores (
  school_id uuid not null references public.schools(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  score numeric not null default 0,
  active_members int not null default 0,
  member_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, season_id)
);
create index school_scores_board_idx on public.school_scores (season_id, score desc);
alter table public.school_scores enable row level security;
create policy "school_scores: public read" on public.school_scores
  for select using (true);
grant select on public.school_scores to anon, authenticated;
grant all on public.school_scores to service_role;

-- End-of-season Top 100 snapshot.
create table public.season_school_snapshots (
  season_id uuid not null references public.seasons(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  rank int not null,
  score numeric not null,
  active_members int not null,
  created_at timestamptz not null default now(),
  primary key (season_id, school_id)
);
alter table public.season_school_snapshots enable row level security;
create policy "season_school_snapshots: public read" on public.season_school_snapshots
  for select using (true);
grant select on public.season_school_snapshots to anon, authenticated;
grant all on public.season_school_snapshots to service_role;

create table public.rivalries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  school_a uuid not null references public.schools(id) on delete cascade,
  school_b uuid not null references public.schools(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  a_score numeric not null default 0,
  b_score numeric not null default 0,
  -- Who led at the last heartbeat, so lead flips trigger notifications.
  last_leader text check (last_leader in ('a', 'b')),
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  check (school_a <> school_b)
);
create index rivalries_active_idx on public.rivalries (status, ends_at);
create index rivalries_school_idx on public.rivalries (school_a, school_b);
alter table public.rivalries enable row level security;
create policy "rivalries: public read" on public.rivalries for select using (true);
grant select on public.rivalries to anon, authenticated;
grant all on public.rivalries to service_role;

-- Inter-school communication is preset-only: a key into a fixed list,
-- rendered client-side. No free text can ever cross school lines.
create table public.rivalry_banners (
  id uuid primary key default gen_random_uuid(),
  rivalry_id uuid not null references public.rivalries(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_key text not null,
  created_at timestamptz not null default now()
);
create index rivalry_banners_rivalry_idx on public.rivalry_banners (rivalry_id, created_at desc);
alter table public.rivalry_banners enable row level security;
create policy "rivalry_banners: public read" on public.rivalry_banners
  for select using (true);
grant select on public.rivalry_banners to anon, authenticated;
grant all on public.rivalry_banners to service_role;
