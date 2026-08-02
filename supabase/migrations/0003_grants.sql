-- =============================================================
-- Role privileges (GRANTs)
-- RLS policies only take effect once the API roles have table-level
-- privileges. Without these grants every PostgREST query from the
-- anon/authenticated roles fails with "permission denied for table".
-- Row visibility is still governed by the RLS policies in 0002_rls.sql.
-- =============================================================

grant usage on schema public to anon, authenticated, service_role;

-- anon: read-only access to the (RLS-gated) public catalog.
grant select on all tables in schema public to anon;

-- authenticated: full CRUD, restricted per-row by RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- service_role bypasses RLS and needs everything.
grant all on all tables in schema public to service_role;

-- sequences + functions.
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Ensure future objects created in this schema inherit the same grants.
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
