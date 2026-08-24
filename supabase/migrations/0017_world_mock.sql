-- =============================================================
-- World Mock: monthly globally-synchronized mock exam sittings.
-- Papers release at the bell per timezone band; scripts are
-- handwritten, scanned, batch-graded per criterion, and ranked
-- into global and country percentiles.
-- =============================================================

-- Country is opt-in and only used for country percentiles/ranks.
alter table public.profiles
  add column if not exists country text
  check (country is null or country ~ '^[A-Z]{2}$');

create table public.mock_papers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level_code text not null default 'SL' check (level_code in ('SL', 'HL')),
  language text not null default 'en',
  title text not null,
  -- The paper itself (markdown + LaTeX). Never readable by students until
  -- their sitting opens: no student select policy exists on this table —
  -- the sitting API serves the body through the service role at the bell.
  body text not null default '',
  duration_minutes int not null default 90 check (duration_minutes between 10 and 300),
  -- [{"id","title","description","maxMarks","topicId"?}]
  markscheme jsonb not null default '[]',
  status text not null default 'draft'
    check (status in ('draft', 'calibration', 'scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mock_papers enable row level security;
create policy "mock_papers: admin all" on public.mock_papers
  for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.mock_papers to authenticated;
grant all on public.mock_papers to service_role;

create table public.mock_sittings (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.mock_papers(id) on delete cascade,
  band text not null check (band in ('americas', 'emea', 'apac')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  results_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (paper_id, band),
  check (closes_at > opens_at),
  check (results_at >= closes_at)
);
create index mock_sittings_open_idx on public.mock_sittings (opens_at);
alter table public.mock_sittings enable row level security;
-- Sittings (times, band, status) are public: countdowns need them.
create policy "mock_sittings: public read" on public.mock_sittings
  for select using (true);
create policy "mock_sittings: admin write" on public.mock_sittings
  for all using (public.is_admin()) with check (public.is_admin());
grant select on public.mock_sittings to anon, authenticated;
grant insert, update, delete on public.mock_sittings to authenticated;
grant all on public.mock_sittings to service_role;

create table public.mock_entries (
  id uuid primary key default gen_random_uuid(),
  sitting_id uuid not null references public.mock_sittings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'entered' check (status in (
    'entered', 'started', 'submitted', 'late', 'grading', 'graded', 'quarantined'
  )),
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sitting_id, user_id)
);
create index mock_entries_grading_idx on public.mock_entries (status, submitted_at);
alter table public.mock_entries enable row level security;
create policy "mock_entries: self read" on public.mock_entries
  for select using (auth.uid() = user_id);
grant select on public.mock_entries to authenticated;
grant all on public.mock_entries to service_role;

-- One student may sit a paper once across all bands.
create unique index mock_entries_one_per_paper on public.mock_entries (user_id, sitting_id);
create or replace function public.mock_entry_paper_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from public.mock_entries e
    join public.mock_sittings s1 on s1.id = e.sitting_id
    join public.mock_sittings s2 on s2.id = new.sitting_id
    where e.user_id = new.user_id
      and s1.paper_id = s2.paper_id
      and e.id is distinct from new.id
  ) then
    raise exception 'already entered this paper in another band';
  end if;
  return new;
end $$;
create trigger mock_entry_paper_guard
  before insert on public.mock_entries
  for each row execute function public.mock_entry_paper_guard();

create table public.mock_scripts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.mock_entries(id) on delete cascade,
  page_index int not null default 0,
  image_path text not null,
  ocr_text text,
  created_at timestamptz not null default now()
);
create index mock_scripts_entry_idx on public.mock_scripts (entry_id, page_index);
alter table public.mock_scripts enable row level security;
create policy "mock_scripts: self read" on public.mock_scripts
  for select using (exists (
    select 1 from public.mock_entries e
    where e.id = entry_id and e.user_id = auth.uid()
  ));
grant select on public.mock_scripts to authenticated;
grant all on public.mock_scripts to service_role;

create table public.mock_results (
  entry_id uuid primary key references public.mock_entries(id) on delete cascade,
  total_awarded int not null default 0,
  total_max int not null default 0,
  -- [{"criterionId","title","maxMarks","awarded","comment"}]
  criteria jsonb not null default '[]',
  grader text not null default 'ai' check (grader in ('ai', 'keywords')),
  global_percentile int,
  country_percentile int,
  country_rank int,
  released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mock_results enable row level security;
-- Students see their own result only on Results Day (released).
create policy "mock_results: self read released" on public.mock_results
  for select using (released and exists (
    select 1 from public.mock_entries e
    where e.id = entry_id and e.user_id = auth.uid()
  ));
grant select on public.mock_results to authenticated;
grant all on public.mock_results to service_role;

-- Atomic work claiming for the grading worker: parallel workers never
-- double-grade thanks to SKIP LOCKED.
create or replace function public.claim_mock_entries(batch int)
returns setof public.mock_entries
language sql security definer set search_path = public as $$
  update public.mock_entries
  set status = 'grading'
  where id in (
    select id from public.mock_entries
    where status in ('submitted', 'late')
    order by submitted_at
    limit batch
    for update skip locked
  )
  returning *;
$$;
revoke all on function public.claim_mock_entries(int) from public, anon, authenticated;

-- Integrity reviews already accept source_kind 'mock_entry' (0015).
