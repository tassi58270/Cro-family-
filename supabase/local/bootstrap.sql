-- Local and CI only: recreates the parts of Supabase that the migrations rely
-- on, so that they run unchanged on a plain Postgres. Never run on Supabase.

-- Roles belong to the whole server: test files that start together may both
-- try to create them, so the loser of that race simply carries on.
do $$
declare
  r record;
begin
  for r in select * from (values
    ('anon', 'nologin noinherit'),
    ('authenticated', 'nologin noinherit'),
    ('service_role', 'nologin noinherit bypassrls')
  ) as roles(name, options) loop
    if not exists (select 1 from pg_roles where rolname = r.name) then
      begin
        execute format('create role %I %s', r.name, r.options);
      exception when duplicate_object or unique_violation then
        null;
      end;
    end if;
  end loop;
end
$$;

grant anon, authenticated, service_role to current_user;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema extensions, auth to anon, authenticated, service_role;

-- Same definitions as Supabase: the user id and role come from the JWT claims
-- that the server sets for the transaction.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
