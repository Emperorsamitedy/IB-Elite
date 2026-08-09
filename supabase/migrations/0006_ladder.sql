-- =============================================================
-- World Ladder: live 1v1 matchups on the same past paper.
-- =============================================================

create type ladder_status as enum ('WAITING', 'ACTIVE', 'COMPLETE');

create table public.ladder_matches (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  -- Papers are not a table: questions carry `paper` text and `year`.
  paper_ref text,
  paper_year int,
  level_code text not null default 'SL' check (level_code in ('SL', 'HL')),
  student_a_id uuid not null references auth.users(id) on delete cascade,
  student_b_id uuid references auth.users(id) on delete cascade,
  status ladder_status not null default 'WAITING',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ladder_matches_distinct_players check (student_b_id is null or student_b_id <> student_a_id)
);
create index ladder_matches_waiting_idx
  on public.ladder_matches (subject_id, level_code, status);
create index ladder_matches_players_idx
  on public.ladder_matches (student_a_id, student_b_id);

create table public.ladder_progress (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.ladder_matches(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  current_question_index int not null default 0,
  correct_count int not null default 0,
  final_score int,
  is_complete boolean not null default false,
  last_updated_at timestamptz not null default now(),
  unique (match_id, student_id)
);
create index ladder_progress_match_idx on public.ladder_progress (match_id);

create table public.ladder_leaderboard (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references auth.users(id) on delete cascade,
  country text,
  school text,
  wins int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now()
);
create index ladder_leaderboard_rank_idx on public.ladder_leaderboard (wins desc);
create index ladder_leaderboard_country_idx on public.ladder_leaderboard (country, wins desc);

alter table public.ladder_matches enable row level security;
alter table public.ladder_progress enable row level security;
alter table public.ladder_leaderboard enable row level security;

-- Players read their own matches; writes go through the service role so a
-- player cannot forge the opponent's side.
create policy "ladder matches: participants read" on public.ladder_matches
  for select using (auth.uid() = student_a_id or auth.uid() = student_b_id);

create policy "ladder progress: participants read" on public.ladder_progress
  for select using (
    exists (
      select 1 from public.ladder_matches m
      where m.id = match_id
        and (auth.uid() = m.student_a_id or auth.uid() = m.student_b_id)
    )
  );

create policy "ladder leaderboard: public read" on public.ladder_leaderboard
  for select using (true);

grant select on public.ladder_matches, public.ladder_progress, public.ladder_leaderboard to anon, authenticated;
grant all on public.ladder_matches, public.ladder_progress, public.ladder_leaderboard to service_role;
