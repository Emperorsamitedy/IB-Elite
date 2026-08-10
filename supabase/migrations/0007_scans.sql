-- =============================================================
-- Scan and Bleed: uploaded answer scans, OCR and rubric annotation.
-- =============================================================

create type scan_status as enum ('UPLOADED', 'PROCESSING', 'ANNOTATED', 'FAILED');

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  -- Object path inside the private `scans` bucket.
  image_url text not null,
  ocr_text text,
  ocr_bounding_boxes jsonb,
  annotation_result jsonb,
  status scan_status not null default 'UPLOADED',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scans_student_idx on public.scans (student_id, created_at desc);
create index scans_question_idx on public.scans (question_id);

alter table public.scans enable row level security;

-- Students read their own scans; the pipeline writes via the service role.
create policy "scans: self read" on public.scans
  for select using (auth.uid() = student_id);

grant select on public.scans to authenticated;
grant all on public.scans to service_role;

-- Private bucket: scans are a student's own work and never public.
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;

create policy "scans bucket: owner read" on storage.objects
  for select using (bucket_id = 'scans' and owner = auth.uid());
