-- =============================================================
-- Row-Level Security
-- Content catalog: readable by everyone; writable only by admins.
-- User data: each user can only access their own rows.
-- =============================================================

-- ---------- enable RLS ----------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.subjects enable row level security;
alter table public.levels enable row level security;
alter table public.topics enable row level security;
alter table public.subtopics enable row level security;
alter table public.questions enable row level security;
alter table public.question_assets enable row level security;
alter table public.user_subjects enable row level security;
alter table public.exam_dates enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_session_questions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.bookmarks enable row level security;
alter table public.mistakes enable row level security;
alter table public.notes enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.analytics_events enable row level security;

-- ---------- profiles ----------
create policy "profiles: self read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles: self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- preferences ----------
create policy "prefs: self all" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- content catalog (public read, admin write) ----------
create policy "subjects: read" on public.subjects for select using (true);
create policy "subjects: admin write" on public.subjects
  for all using (public.is_admin()) with check (public.is_admin());

create policy "levels: read" on public.levels for select using (true);
create policy "levels: admin write" on public.levels
  for all using (public.is_admin()) with check (public.is_admin());

create policy "topics: read" on public.topics for select using (true);
create policy "topics: admin write" on public.topics
  for all using (public.is_admin()) with check (public.is_admin());

create policy "subtopics: read" on public.subtopics for select using (true);
create policy "subtopics: admin write" on public.subtopics
  for all using (public.is_admin()) with check (public.is_admin());

-- Questions: published rows visible to authenticated users; admins see all.
create policy "questions: read published" on public.questions
  for select using (
    (status = 'published' and auth.role() = 'authenticated') or public.is_admin()
  );
create policy "questions: admin write" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assets: read" on public.question_assets
  for select using (
    auth.role() = 'authenticated' or public.is_admin()
  );
create policy "assets: admin write" on public.question_assets
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- user-owned data ----------
create policy "user_subjects: self" on public.user_subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "exam_dates: self" on public.exam_dates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions: self" on public.practice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_questions: self" on public.practice_session_questions
  for all using (
    exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "attempts: self" on public.question_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bookmarks: self" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "mistakes: self" on public.mistakes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes: self" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plans: self" on public.study_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plan_items: self" on public.study_plan_items
  for all using (
    exists (
      select 1 from public.study_plans p
      where p.id = plan_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.study_plans p
      where p.id = plan_id and p.user_id = auth.uid()
    )
  );

-- Subscriptions: user may read own; writes happen server-side (service role).
create policy "subscriptions: self read" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "ai_conversations: self" on public.ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_messages: self" on public.ai_messages
  for all using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Analytics: users can insert their own events; reads are admin-only.
create policy "analytics: self insert" on public.analytics_events
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "analytics: admin read" on public.analytics_events
  for select using (public.is_admin());

-- ---------- storage bucket for question assets (private) ----------
insert into storage.buckets (id, name, public)
values ('question-assets', 'question-assets', false)
on conflict (id) do nothing;

create policy "assets read (authenticated)" on storage.objects
  for select using (bucket_id = 'question-assets' and auth.role() = 'authenticated');
create policy "assets admin write" on storage.objects
  for all using (bucket_id = 'question-assets' and public.is_admin())
  with check (bucket_id = 'question-assets' and public.is_admin());
