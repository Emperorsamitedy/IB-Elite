-- =============================================================
-- Rivalry lead-change notifications get a cooldown: a close race
-- flipping hourly must not page two whole schools every flip.
-- =============================================================

alter table public.rivalries
  add column if not exists last_lead_notified_at timestamptz;
