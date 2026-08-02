-- =============================================================
-- Syllabus hierarchy: Subject → Theme → Topic → Subtopic → Question
-- Everything is DB-driven so admins can restructure the syllabus
-- without any code change.
-- =============================================================

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  level_code text check (level_code in ('SL', 'HL')),
  sort_order int not null default 0,
  status content_status not null default 'published',
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);
create index if not exists themes_subject_idx on public.themes (subject_id, sort_order);

alter table public.topics
  add column if not exists theme_id uuid references public.themes(id) on delete set null,
  add column if not exists level_code text check (level_code in ('SL', 'HL')),
  add column if not exists status content_status not null default 'published',
  add column if not exists estimated_minutes int;
create index if not exists topics_theme_idx on public.topics (theme_id, sort_order);

alter table public.subtopics
  add column if not exists description text,
  add column if not exists status content_status not null default 'published';

alter table public.questions
  add column if not exists question_number text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists estimated_minutes int;
create index if not exists questions_subtopic_idx on public.questions (subtopic_id);

-- ---------- RLS + grants for the new table ----------
alter table public.themes enable row level security;

drop policy if exists "themes: public read" on public.themes;
create policy "themes: public read" on public.themes
  for select using (status = 'published' or public.is_admin());

drop policy if exists "themes: admin write" on public.themes;
create policy "themes: admin write" on public.themes
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.themes to anon;
grant select, insert, update, delete on public.themes to authenticated;
grant all on public.themes to service_role;
