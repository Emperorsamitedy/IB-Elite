-- =============================================================
-- Whiteboards: savable working-out canvases, either tied to a question
-- attempt or kept as a freeform scratchpad (question_id is null).
-- =============================================================

create table public.whiteboards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  title text,
  -- Fabric.js canvas.toJSON() output, so work can be reopened and continued.
  canvas_data jsonb not null default '{}'::jsonb,
  -- Object path inside the private `scans` bucket, signed on read: stored
  -- URLs would expire.
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whiteboards_student_idx
  on public.whiteboards (student_id, updated_at desc);
create index whiteboards_question_idx
  on public.whiteboards (student_id, question_id, updated_at desc);

alter table public.whiteboards enable row level security;

create policy "whiteboards: self read" on public.whiteboards
  for select using (auth.uid() = student_id);
create policy "whiteboards: self write" on public.whiteboards
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

grant select, insert, update, delete on public.whiteboards to authenticated;
grant all on public.whiteboards to service_role;
