-- Standard Supabase API-role grants. Hosted projects get these via default
-- privileges; local stacks need them explicit or PostgREST gets
-- "permission denied" on every table. RLS policies still gate row access.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;
