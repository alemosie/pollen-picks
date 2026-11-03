-- Applied to the Supabase project "Pollen Picks" (hmzprlzhvhdwpjgrymrk) on 2026-11-03 as round1c_grant_service_role_tables.
-- The app talks to these tables only through the secret key (role service_role). Newer Supabase projects do not
-- auto-grant privileges on new public tables, so grant them explicitly. anon/authenticated stay locked out.
grant select, insert, update, delete on public.users, public.brand_profiles, public.connections to service_role;

-- Same for tables added in later migrations (applies to objects created by the migration role).
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
