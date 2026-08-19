-- =============================================================
-- Curriculum-Locked Solve & Grade: retrieval-augmented grading of a
-- photographed problem against real syllabus text and published answers.
-- =============================================================

-- Subtopics can be HL-only inside an otherwise SL topic; null means
-- "inherit the parent topic's level".
alter table public.subtopics
  add column if not exists level_code text check (level_code in ('SL', 'HL'));

-- Original summaries of the official syllabus, loaded by an admin. Nothing in
-- the app generates rows here — grading is only as grounded as this table.
create table public.syllabus_content (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete cascade,
  content_text text not null,
  -- Command terms this element can legitimately be assessed with.
  command_terms jsonb not null default '[]'::jsonb,
  -- Techniques the syllabus reserves for HL, used for the scope check.
  hl_only boolean not null default false,
  source_note text,
  created_at timestamptz not null default now()
);
create index syllabus_content_topic_idx on public.syllabus_content (topic_id);
create index syllabus_content_subtopic_idx on public.syllabus_content (subtopic_id);

create type solve_verdict as enum (
  'CORRECT',
  'PARTIAL',
  'INCORRECT',
  'OUT_OF_SYLLABUS_SCOPE',
  'INSUFFICIENT_DATA'
);

create table public.curriculum_solve_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  -- Object path inside the private `scans` bucket, reused from Scan and Bleed.
  image_url text not null,
  ocr_text text,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  -- What was actually retrieved, kept for auditability of the verdict.
  retrieved_context jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  verdict solve_verdict not null default 'INSUFFICIENT_DATA',
  source_citations jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index curriculum_solve_sessions_student_idx
  on public.curriculum_solve_sessions (student_id, created_at desc);

-- Per-day counter rather than a rolling window: one row per student per day.
create table public.curriculum_solve_usage (
  student_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count int not null default 0,
  primary key (student_id, usage_date)
);

alter table public.syllabus_content enable row level security;
alter table public.curriculum_solve_sessions enable row level security;
alter table public.curriculum_solve_usage enable row level security;

-- Syllabus content is reference material: readable by any signed-in student,
-- writable only by admins (and the service role, which bypasses RLS).
create policy "syllabus_content: read" on public.syllabus_content
  for select using (auth.role() = 'authenticated');
create policy "syllabus_content: admin write" on public.syllabus_content
  for all using (public.is_admin()) with check (public.is_admin());

create policy "solve sessions: self read" on public.curriculum_solve_sessions
  for select using (auth.uid() = student_id);
create policy "solve usage: self read" on public.curriculum_solve_usage
  for select using (auth.uid() = student_id);

grant select on public.syllabus_content to authenticated;
grant select on public.curriculum_solve_sessions to authenticated;
grant select on public.curriculum_solve_usage to authenticated;
grant all on public.syllabus_content to service_role;
grant all on public.curriculum_solve_sessions to service_role;
grant all on public.curriculum_solve_usage to service_role;
