-- Step 10: family accounts and contributions (cahier des charges, 4, 6.7, 7).

-- « C’est moi » : a member says which person of the tree they are; an
-- administrator confirms it.
alter type public.suggestion_kind add value if not exists 'claim';

-- In which language to write back to them.
alter table public.access_requests
  add column locale public.locale not null default 'fr';
alter table public.invitations
  add column full_name text,
  add column locale public.locale not null default 'fr',
  add column message text;

-- Every email the site writes: sent, only written to the log (no email
-- service yet, or in tests), or failed. Never readable through the site.
create table private.emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipient extensions.citext not null,
  subject text not null,
  body text not null,
  topic text not null,
  delivery text not null check (delivery in ('sent', 'logged', 'failed')),
  error text
);
create index on private.emails (created_at desc);
create index on private.emails (recipient, created_at desc);
alter table private.emails enable row level security;

-- The members and their addresses, for the Members screen. Addresses live in
-- the private schema: only an administrator gets them, through this function.
create function public.admin_members()
returns table (
  id uuid,
  email text,
  display_name text,
  role public.member_role,
  person_id uuid,
  disabled_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'administrators only' using errcode = '42501';
  end if;
  return query
    select p.id, a.email::text, p.display_name, p.role, p.person_id,
           p.disabled_at, a.last_login_at, p.created_at
    from public.profiles p join private.accounts a on a.id = p.id
    order by p.created_at;
end
$$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;
