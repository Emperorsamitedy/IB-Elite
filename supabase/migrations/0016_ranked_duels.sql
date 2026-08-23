-- =============================================================
-- Ranked Exam Duels: structured answer keys, per-subject Elo,
-- monthly seasons and leagues, server-authoritative answers with
-- timing, matchmaking queue, and challenge links.
-- =============================================================

-- ---------- structured answers ----------
-- Ranked duels are graded by the server, which needs deterministic
-- keys. Free-text questions stay usable everywhere else.
alter table public.questions
  add column if not exists answer_type text not null default 'free'
    check (answer_type in ('free', 'mcq', 'numeric', 'exact')),
  -- mcq:     {"options": ["...", ...], "correct": 2}
  -- numeric: {"value": 9.81, "tolerance": 0.01}
  -- exact:   {"accept": ["x=2", "2"]}  (case/whitespace-insensitive)
  add column if not exists answer_key jsonb;

-- ---------- seasons ----------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  -- e.g. '2026-09'; one row per calendar month, created lazily.
  slug text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.seasons enable row level security;
create policy "seasons: public read" on public.seasons for select using (true);
grant select on public.seasons to anon, authenticated;
grant all on public.seasons to service_role;

-- ---------- per-subject, per-season Elo ----------
create table public.subject_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  elo int not null default 1200,
  matches_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id, season_id)
);
create index subject_ratings_board_idx
  on public.subject_ratings (season_id, subject_id, elo desc);
alter table public.subject_ratings enable row level security;
-- Ratings are public by design: they appear on profiles and boards.
create policy "subject_ratings: public read" on public.subject_ratings
  for select using (true);
grant select on public.subject_ratings to anon, authenticated;
grant all on public.subject_ratings to service_role;

-- End-of-season snapshot with final league placement.
create table public.season_placements (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  elo int not null,
  league text not null,
  rank int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id, season_id)
);
alter table public.season_placements enable row level security;
create policy "season_placements: public read" on public.season_placements
  for select using (true);
grant select on public.season_placements to anon, authenticated;
grant all on public.season_placements to service_role;

-- ---------- matches: ranked vs friendly, season tag ----------
alter table public.ladder_matches
  add column if not exists mode text not null default 'ranked'
    check (mode in ('ranked', 'friendly')),
  add column if not exists season_id uuid references public.seasons(id) on delete set null,
  -- Total time each player has for the whole set, enforced server-side.
  add column if not exists time_limit_seconds int not null default 450;

-- ---------- per-question server record ----------
-- served_at is stamped when the server first hands out the question;
-- answered_at when the answer arrives. The client never grades.
create table public.match_answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.ladder_matches(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_index int not null,
  answer text,
  is_correct boolean,
  served_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (match_id, student_id, question_index)
);
create index match_answers_match_idx on public.match_answers (match_id, student_id);
alter table public.match_answers enable row level security;
create policy "match_answers: self read" on public.match_answers
  for select using (auth.uid() = student_id);
grant select on public.match_answers to authenticated;
grant all on public.match_answers to service_role;

-- ---------- matchmaking queue ----------
create table public.duel_queue (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level_code text not null default 'SL' check (level_code in ('SL', 'HL')),
  elo int not null default 1200,
  mode text not null default 'ranked' check (mode in ('ranked', 'friendly')),
  enqueued_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);
create index duel_queue_search_idx
  on public.duel_queue (subject_id, level_code, mode, elo);
alter table public.duel_queue enable row level security;
create policy "duel_queue: self read" on public.duel_queue
  for select using (auth.uid() = user_id);
grant select on public.duel_queue to authenticated;
grant all on public.duel_queue to service_role;

-- ---------- challenge links ----------
create table public.duel_challenges (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  creator_id uuid not null references auth.users(id) on delete cascade,
  -- Direct rematch challenges name an opponent; open links leave it null.
  opponent_id uuid references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level_code text not null default 'SL' check (level_code in ('SL', 'HL')),
  mode text not null default 'friendly' check (mode in ('ranked', 'friendly')),
  match_id uuid references public.ladder_matches(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index duel_challenges_creator_idx on public.duel_challenges (creator_id, created_at desc);
alter table public.duel_challenges enable row level security;
create policy "duel_challenges: involved read" on public.duel_challenges
  for select using (
    auth.uid() = creator_id or auth.uid() = opponent_id or auth.uid() = claimed_by
  );
grant select on public.duel_challenges to authenticated;
grant all on public.duel_challenges to service_role;
