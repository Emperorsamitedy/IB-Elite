-- =============================================================
-- Question figures. `question_assets` was created in 0001 but never used: it
-- only held a storage path and an alt string. Widen it so a figure can also be
-- a diagram drawn on the whiteboard canvas (editable Fabric JSON alongside the
-- rendered PNG) or a graph plotted from a spec with no file at all. Files stay
-- in the private `question-assets` bucket from 0002, signed at read time.
-- =============================================================

alter table public.question_assets
  rename column alt to alt_text;

alter table public.question_assets
  add column caption text,
  add column canvas_data jsonb,
  add column graph_spec jsonb,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- A graph is drawn from its spec, so it has no stored file.
alter table public.question_assets
  alter column storage_path drop not null;

alter table public.question_assets
  drop constraint question_assets_kind_check;

alter table public.question_assets
  alter column kind set default 'image',
  add constraint question_assets_kind_check
    check (kind in ('image', 'diagram', 'graph')),
  add constraint question_assets_payload check (
    (kind = 'graph' and graph_spec is not null)
    or (kind <> 'graph' and storage_path is not null)
  );

create index if not exists question_assets_question_idx
  on public.question_assets (question_id, sort_order);
