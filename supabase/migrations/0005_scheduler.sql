-- =============================================================
-- Cross-subject deadline orchestrator: deadlines and study blocks.
-- =============================================================

create type deadline_type as enum ('IA', 'EE', 'TOK', 'MOCK', 'EXAM');

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  type deadline_type not null,
  subject_id uuid references public.subjects(id) on delete cascade,
  due_date date not null,
  title text not null,
  created_at timestamptz not null default now(),
  -- EE and TOK are not attached to a subject.
  constraint deadlines_subject_scope check (
    (type in ('EE', 'TOK') and subject_id is null) or type not in ('EE', 'TOK')
  )
);
create index deadlines_student_idx on public.deadlines (student_id, due_date);

create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  -- Null for EE/TOK work, which belongs to no subject.
  subject_id uuid references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  deadline_id uuid references public.deadlines(id) on delete set null,
  allocated_minutes int not null check (allocated_minutes > 0),
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);
create index study_blocks_student_date_idx on public.study_blocks (student_id, date);

alter table public.deadlines enable row level security;
alter table public.study_blocks enable row level security;

create policy "deadlines: self" on public.deadlines
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy "study blocks: self" on public.study_blocks
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

grant select on public.deadlines, public.study_blocks to anon;
grant select, insert, update, delete on public.deadlines, public.study_blocks to authenticated;
grant all on public.deadlines, public.study_blocks to service_role;
