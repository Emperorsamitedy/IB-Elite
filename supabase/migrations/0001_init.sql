-- =============================================================
-- IB Revision Platform — initial schema
-- Content is fully DB-driven. User data is protected by RLS.
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type difficulty as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_rating as enum ('easy', 'okay', 'difficult', 'wrong');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_mode as enum ('practice', 'exam', 'mistakes', 'daily');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('active', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_intensity as enum ('light', 'balanced', 'intense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =============================================================
-- Identity
-- =============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'admin')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goals text[] not null default '{}',
  intensity plan_intensity not null default 'balanced',
  daily_target int not null default 15,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  reduce_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

-- =============================================================
-- Content catalog (admin-managed, read-only for users)
-- =============================================================
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  group_name text not null default 'General',
  description text,
  color text not null default '#6366f1',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  unique (subject_id, code)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order int not null default 0,
  unique (topic_id, slug)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level_id uuid references public.levels(id) on delete set null,
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  title text,
  prompt text not null,
  answer text,
  solution text,
  difficulty difficulty not null default 'medium',
  marks int not null default 1,
  question_type text not null default 'short-answer',
  calculator boolean,
  year int,
  paper text,
  source text,
  license text,
  is_ai_generated boolean not null default false,
  status content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_subject_idx on public.questions (subject_id);
create index questions_topic_idx on public.questions (topic_id);
create index questions_difficulty_idx on public.questions (difficulty);
create index questions_status_idx on public.questions (status);

create table public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  kind text not null default 'question' check (kind in ('question', 'markscheme', 'diagram')),
  storage_path text not null,
  alt text,
  sort_order int not null default 0
);

-- =============================================================
-- User activity
-- =============================================================
create table public.user_subjects (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level_id uuid references public.levels(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

create table public.exam_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level_id uuid references public.levels(id) on delete set null,
  label text,
  exam_date date not null,
  created_at timestamptz not null default now()
);
create index exam_dates_user_idx on public.exam_dates (user_id);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  mode session_mode not null default 'practice',
  status session_status not null default 'active',
  difficulty difficulty,
  topic_ids uuid[] not null default '{}',
  time_limit_seconds int,
  total_questions int not null default 0,
  current_index int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index practice_sessions_user_idx on public.practice_sessions (user_id, created_at desc);

create table public.practice_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position int not null default 0,
  viewed_at timestamptz,
  answered_at timestamptz,
  confidence confidence_rating,
  is_correct boolean,
  unique (session_id, question_id)
);
create index psq_session_idx on public.practice_session_questions (session_id, position);

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete set null,
  confidence confidence_rating,
  is_correct boolean,
  time_spent_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create index attempts_user_idx on public.question_attempts (user_id, created_at desc);
create index attempts_question_idx on public.question_attempts (question_id);

create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, question_id)
);
create index mistakes_user_idx on public.mistakes (user_id, resolved);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_idx on public.notes (user_id);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Revision plan',
  intensity plan_intensity not null default 'balanced',
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);
create index study_plans_user_idx on public.study_plans (user_id);

create table public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  day date not null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  description text,
  estimated_minutes int not null default 30,
  question_count int not null default 10,
  completed boolean not null default false,
  sort_order int not null default 0
);
create index study_plan_items_plan_idx on public.study_plan_items (plan_id, day);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'free',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  title text not null default 'Tutor session',
  created_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, created_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  hint_level int,
  created_at timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events (name, created_at desc);

-- ---------- updated_at triggers ----------
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_questions_updated before update on public.questions
  for each row execute function public.set_updated_at();
create trigger trg_notes_updated before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------- new-user bootstrap ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  ) on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, status) values (new.id, 'free')
  on conflict (user_id) do nothing;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
