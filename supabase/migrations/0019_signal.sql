-- =============================================================
-- The Signal: a verified, versioned academic rating per subject,
-- derived from the immutable performance ledger. Includes the
-- scout-portal data model (flagged off until Phase E) so history
-- is complete from day one.
-- =============================================================

create table public.signal_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  rating numeric not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  sample_size int not null,
  trajectory text not null check (trajectory in ('improving', 'stable', 'declining')),
  verification_tier text not null default 'standard'
    check (verification_tier in ('standard', 'verified', 'proctored')),
  algorithm_version int not null default 1,
  computed_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);
alter table public.signal_ratings enable row level security;
create policy "signal_ratings: self read" on public.signal_ratings
  for select using (auth.uid() = user_id);
grant select on public.signal_ratings to authenticated;
grant all on public.signal_ratings to service_role;

-- Opt-in public profile; every visible field is an explicit choice.
create table public.signal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public boolean not null default false,
  show_country boolean not null default false,
  show_trajectory boolean not null default true,
  show_history boolean not null default true,
  -- Which subjects are exposed; empty means all rated subjects.
  subject_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.signal_profiles enable row level security;
create policy "signal_profiles: self all" on public.signal_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.signal_profiles to authenticated;
grant all on public.signal_profiles to service_role;

-- Voluntary official-result reports powering public accuracy stats.
create table public.calibration_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  -- Signal state frozen at report time, so accuracy is honest.
  predicted_rating numeric not null,
  predicted_confidence numeric not null,
  official_grade int not null check (official_grade between 1 and 7),
  exam_session text not null,
  created_at timestamptz not null default now(),
  unique (user_id, subject_id, exam_session)
);
alter table public.calibration_reports enable row level security;
create policy "calibration_reports: self all" on public.calibration_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert on public.calibration_reports to authenticated;
grant all on public.calibration_reports to service_role;

-- ---------- scout portal (Phase E; flagged off) ----------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'scholarship'
    check (kind in ('scholarship', 'university', 'other')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.institutions enable row level security;
grant all on public.institutions to service_role;

create table public.institution_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role text not null default 'scout',
  created_at timestamptz not null default now()
);
alter table public.institution_members enable row level security;
grant all on public.institution_members to service_role;

-- A student must approve before any identity is revealed.
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.contact_requests enable row level security;
create policy "contact_requests: student read/respond" on public.contact_requests
  for select using (auth.uid() = student_id);
create policy "contact_requests: student respond" on public.contact_requests
  for update using (auth.uid() = student_id) with check (auth.uid() = student_id);
grant select, update on public.contact_requests to authenticated;
grant all on public.contact_requests to service_role;

-- Every institutional read of student data is audited, immutably.
create table public.institution_audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.institution_audit_log enable row level security;
grant all on public.institution_audit_log to service_role;

insert into public.rating_algorithm_versions (name, version, config) values
  ('signal', 1, '{"weights": {"mock_result": 3, "duel_result": 2, "practice_result": 1}, "confidence_k": 10, "trajectory_threshold": 5}');
