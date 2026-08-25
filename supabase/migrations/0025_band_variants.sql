-- =============================================================
-- Per-band paper variants: the same paper across timezone bands
-- leaks — EMEA sitters can post it hours before APAC opens. A
-- sitting may now carry its own body (same markscheme skeleton,
-- different numbers); unset falls back to the shared paper.
-- =============================================================

alter table public.mock_sittings
  add column if not exists body_override text;
