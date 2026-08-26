-- =============================================================
-- The cross-subject deadline-orchestrator (migration 0005) never
-- got a UI and nothing ever wrote a deadline; the live planner
-- is /plan on study_plans, and World Mock's practice plans cover
-- the targeted-revision promise. Both tables are empty in every
-- environment. Code and schema are recoverable from git history
-- if the idea is ever resurrected.
-- =============================================================

drop table if exists public.study_blocks;
drop table if exists public.deadlines;
