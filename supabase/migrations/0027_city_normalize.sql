-- =============================================================
-- City names feed the School Wars city board by equality, so
-- "addis ababa", " Addis  Ababa " and "ADDIS ABABA" must be one
-- city. Normalize existing rows; the app normalizes on write.
-- =============================================================

update public.schools
set city = initcap(regexp_replace(btrim(city), '\s+', ' ', 'g'))
where city is not null;

update public.school_requests
set city = initcap(regexp_replace(btrim(city), '\s+', ' ', 'g'))
where city is not null;
