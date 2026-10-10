-- Access rules (cahier des charges, section 4), enforced by the database.
--
-- The server runs every request inside a transaction as one of two roles:
--   anon           a visitor, not signed in;
--   authenticated  a signed-in account, whose id is auth.uid().
-- Whether that account is a member or an administrator comes from
-- public.profiles. A disabled account is treated like a visitor.
--
-- The rule that matters most: a living person is never visible to visitors,
-- neither directly nor through a link, a photo, a story, an event or a
-- source. In the public tree, they only appear as « Personne vivante »,
-- through public.tree_people(), without name, dates or anything else.

-- ── Who is asking ──────────────────────────────────────────────────────────

create function app.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and disabled_at is null
  )
$$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and disabled_at is null and role = 'admin'
  )
$$;

-- ── Living or not ──────────────────────────────────────────────────────────

-- The latest day someone may have been born, given an imprecise date.
-- « vers » allows ten years of margin; « après » has no upper bound.
create function app.latest_birth(birth date, birth_precision public.date_precision)
returns date
language sql immutable set search_path = ''
as $$
  select case
    when birth is null or birth_precision = 'after' then null
    when birth_precision = 'day' then birth
    when birth_precision = 'month'
      then (date_trunc('month', birth) + interval '1 month - 1 day')::date
    when birth_precision = 'about'
      then make_date(extract(year from birth)::int + 10, 12, 31)
    else make_date(extract(year from birth)::int, 12, 31)
  end
$$;

-- Family decision (10 October 2026): someone is treated as living unless a
-- death date is known, « décédée » is ticked, or they were certainly born
-- more than 100 years ago.
create function app.is_living(
  deceased boolean,
  birth date,
  birth_precision public.date_precision,
  death date
) returns boolean
language sql stable set search_path = ''
as $$
  select not (
    deceased
    or death is not null
    or coalesce(
      app.latest_birth(birth, birth_precision) + interval '100 years' < current_date,
      false
    )
  )
$$;

create function app.person_is_living(person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select app.is_living(p.deceased, p.birth_date, p.birth_precision, p.death_date)
     from public.people p where p.id = person),
    false
  )
$$;

-- Same rule as the people policy below, usable from other tables' policies.
create function app.person_is_visible(person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.people p
    where p.id = person
      and (
        app.is_admin()
        or (
          p.status = 'published'
          and (
            app.is_member()
            or not app.is_living(p.deceased, p.birth_date, p.birth_precision, p.death_date)
          )
        )
      )
  )
$$;

-- Contents that show a living person are for members only.
create function app.media_shows_living(item uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.media_people mp
    where mp.media_id = item and app.person_is_living(mp.person_id)
  )
$$;

create function app.story_involves_living(item uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.story_people sp
    where sp.story_id = item and app.person_is_living(sp.person_id)
  )
$$;

create function app.event_involves_living(item uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_people ep
    where ep.event_id = item and app.person_is_living(ep.person_id)
  )
$$;

create function app.source_involves_living(item uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.person_sources ps
    where ps.source_id = item and app.person_is_living(ps.person_id)
  ) or exists (
    select 1 from public.filiation_sources fs
    where fs.source_id = item
      and (app.person_is_living(fs.parent_id) or app.person_is_living(fs.child_id))
  ) or exists (
    select 1 from public.union_sources us
    join public.unions u on u.id = us.union_id
    where us.source_id = item
      and (app.person_is_living(u.partner_a)
           or (u.partner_b is not null and app.person_is_living(u.partner_b)))
  )
$$;

-- ── Policies ───────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  -- Every table of the site has row level security, without exception.
  foreach t in array array[
    'places', 'places_i18n', 'branches', 'branches_i18n', 'people', 'people_i18n',
    'unions', 'parent_child', 'titles', 'titles_i18n', 'people_titles',
    'albums', 'albums_i18n', 'media', 'media_i18n', 'media_people',
    'arms', 'arms_i18n', 'events', 'events_i18n', 'stories', 'stories_i18n',
    'story_people', 'story_places', 'story_events', 'event_people', 'place_people',
    'sources', 'person_sources', 'union_sources', 'filiation_sources',
    'profiles', 'access_requests', 'invitations', 'suggestions', 'audit_log'
  ] loop
    -- Not forced: the helper functions above run as the owner and must see
    -- every row to decide what to hide.
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Administrators write all contents; nobody else writes them directly.
  foreach t in array array[
    'places', 'places_i18n', 'branches', 'branches_i18n', 'people', 'people_i18n',
    'unions', 'parent_child', 'titles', 'titles_i18n', 'people_titles',
    'albums', 'albums_i18n', 'media', 'media_i18n', 'media_people',
    'arms', 'arms_i18n', 'events', 'events_i18n', 'stories', 'stories_i18n',
    'story_people', 'story_places', 'story_events', 'event_people', 'place_people',
    'sources', 'person_sources', 'union_sources', 'filiation_sources',
    'invitations'
  ] loop
    execute format(
      'create policy admin_writes on public.%I for all to authenticated
         using (app.is_admin()) with check (app.is_admin())', t);
  end loop;

  -- Plain published contents, readable by everyone.
  foreach t in array array['places', 'branches', 'titles', 'albums', 'arms'] loop
    execute format(
      'create policy read_published on public.%I for select to anon, authenticated
         using (status = ''published'' or app.is_admin())', t);
  end loop;
end
$$;

-- Translations follow their parent: the subquery is itself filtered by the
-- parent's policy.
create policy read_with_parent on public.places_i18n for select to anon, authenticated
  using (exists (select 1 from public.places x where x.id = place_id));
create policy read_with_parent on public.branches_i18n for select to anon, authenticated
  using (exists (select 1 from public.branches x where x.id = branch_id));
create policy read_with_parent on public.titles_i18n for select to anon, authenticated
  using (exists (select 1 from public.titles x where x.id = title_id));
create policy read_with_parent on public.albums_i18n for select to anon, authenticated
  using (exists (select 1 from public.albums x where x.id = album_id));
create policy read_with_parent on public.arms_i18n for select to anon, authenticated
  using (exists (select 1 from public.arms x where x.id = arms_id));
create policy read_with_parent on public.people_i18n for select to anon, authenticated
  using (exists (select 1 from public.people x where x.id = person_id));
create policy read_with_parent on public.media_i18n for select to anon, authenticated
  using (exists (select 1 from public.media x where x.id = media_id));
create policy read_with_parent on public.events_i18n for select to anon, authenticated
  using (exists (select 1 from public.events x where x.id = event_id));
create policy read_with_parent on public.stories_i18n for select to anon, authenticated
  using (exists (select 1 from public.stories x where x.id = story_id));

-- People: deceased and published for visitors; living ones for members too.
create policy read_people on public.people for select to anon, authenticated
  using (
    app.is_admin()
    or (
      status = 'published'
      and (app.is_member() or not app.is_living(deceased, birth_date, birth_precision, death_date))
    )
  );

create policy read_unions on public.unions for select to anon, authenticated
  using (
    app.is_admin()
    or (
      status = 'published'
      and app.person_is_visible(partner_a)
      and (partner_b is null or app.person_is_visible(partner_b))
    )
  );

create policy read_parent_child on public.parent_child for select to anon, authenticated
  using (
    app.is_admin()
    or (
      status = 'published'
      and app.person_is_visible(parent_id)
      and app.person_is_visible(child_id)
    )
  );

create policy read_people_titles on public.people_titles for select to anon, authenticated
  using (
    app.is_admin()
    or (status = 'published' and app.person_is_visible(person_id))
  );

create policy read_media on public.media for select to anon, authenticated
  using (
    app.is_admin()
    or (uploaded_by is not null and uploaded_by = auth.uid())
    or (status = 'published' and (app.is_member() or not app.media_shows_living(id)))
  );

create policy read_media_people on public.media_people for select to anon, authenticated
  using (
    exists (select 1 from public.media x where x.id = media_id)
    and app.person_is_visible(person_id)
  );

create policy read_events on public.events for select to anon, authenticated
  using (
    app.is_admin()
    or (status = 'published' and (app.is_member() or not app.event_involves_living(id)))
  );

create policy read_stories on public.stories for select to anon, authenticated
  using (
    app.is_admin()
    or (author_id is not null and author_id = auth.uid())
    or (status = 'published' and (app.is_member() or not app.story_involves_living(id)))
  );

create policy read_sources on public.sources for select to anon, authenticated
  using (
    app.is_admin()
    or (status = 'published' and (app.is_member() or not app.source_involves_living(id)))
  );

-- Links are visible when both ends are.
create policy read_links on public.story_people for select to anon, authenticated
  using (
    exists (select 1 from public.stories x where x.id = story_id)
    and app.person_is_visible(person_id)
  );
create policy read_links on public.story_places for select to anon, authenticated
  using (
    exists (select 1 from public.stories x where x.id = story_id)
    and exists (select 1 from public.places x where x.id = place_id)
  );
create policy read_links on public.story_events for select to anon, authenticated
  using (
    exists (select 1 from public.stories x where x.id = story_id)
    and exists (select 1 from public.events x where x.id = event_id)
  );
create policy read_links on public.event_people for select to anon, authenticated
  using (
    exists (select 1 from public.events x where x.id = event_id)
    and app.person_is_visible(person_id)
  );
create policy read_links on public.place_people for select to anon, authenticated
  using (
    exists (select 1 from public.places x where x.id = place_id)
    and app.person_is_visible(person_id)
  );
create policy read_links on public.person_sources for select to anon, authenticated
  using (
    exists (select 1 from public.sources x where x.id = source_id)
    and app.person_is_visible(person_id)
  );
create policy read_links on public.union_sources for select to anon, authenticated
  using (
    exists (select 1 from public.sources x where x.id = source_id)
    and exists (select 1 from public.unions x where x.id = union_id)
  );
create policy read_links on public.filiation_sources for select to anon, authenticated
  using (
    exists (select 1 from public.sources x where x.id = source_id)
    and exists (
      select 1 from public.parent_child x
      where x.parent_id = filiation_sources.parent_id
        and x.child_id = filiation_sources.child_id
    )
  );

-- Members write their own stories as drafts and send them for validation;
-- once published, only administrators change them (section 6.4).
create function app.is_own_draft_story(item uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_member() and exists (
    select 1 from public.stories s
    where s.id = item and s.author_id = auth.uid()
      and s.status in ('draft', 'pending', 'rejected')
  )
$$;

create policy write_own_story on public.stories for insert to authenticated
  with check (
    app.is_member() and author_id = auth.uid()
    and status in ('draft', 'pending') and not featured and published_at is null
  );
create policy edit_own_story on public.stories for update to authenticated
  using (app.is_own_draft_story(id))
  with check (
    author_id = auth.uid()
    and status in ('draft', 'pending') and not featured and published_at is null
  );
create policy delete_own_story on public.stories for delete to authenticated
  using (app.is_own_draft_story(id));

create policy write_own_story on public.stories_i18n for all to authenticated
  using (app.is_own_draft_story(story_id))
  with check (app.is_own_draft_story(story_id) and translation = 'original');
create policy write_own_story on public.story_people for all to authenticated
  using (app.is_own_draft_story(story_id))
  with check (app.is_own_draft_story(story_id));
create policy write_own_story on public.story_places for all to authenticated
  using (app.is_own_draft_story(story_id))
  with check (app.is_own_draft_story(story_id));
create policy write_own_story on public.story_events for all to authenticated
  using (app.is_own_draft_story(story_id))
  with check (app.is_own_draft_story(story_id));

-- Members send photos; they stay pending until an administrator publishes them.
create function app.is_own_pending_media(item uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_member() and exists (
    select 1 from public.media m
    where m.id = item and m.uploaded_by = auth.uid()
      and m.status in ('draft', 'pending', 'rejected')
  )
$$;

create policy send_own_media on public.media for insert to authenticated
  with check (
    app.is_member() and uploaded_by = auth.uid() and status in ('draft', 'pending')
  );
create policy edit_own_media on public.media for update to authenticated
  using (app.is_own_pending_media(id))
  with check (uploaded_by = auth.uid() and status in ('draft', 'pending'));
create policy describe_own_media on public.media_i18n for all to authenticated
  using (app.is_own_pending_media(media_id))
  with check (app.is_own_pending_media(media_id));
create policy identify_own_media on public.media_people for all to authenticated
  using (app.is_own_pending_media(media_id))
  with check (app.is_own_pending_media(media_id));

-- Profiles: everyone sees their own; administrators see and manage all.
create policy read_profiles on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_admin());
create policy update_profiles on public.profiles for update to authenticated
  using (id = auth.uid() or app.is_admin())
  with check (id = auth.uid() or app.is_admin());

-- A member may only change their own name and language; the role, the
-- matching person and the disabled flag are for administrators.
create function app.guard_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() and (
    new.role is distinct from old.role
    or new.person_id is distinct from old.person_id
    or new.disabled_at is distinct from old.disabled_at
    or new.id is distinct from old.id
  ) then
    raise exception 'only an administrator can change this' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger guard_profile before update on public.profiles
  for each row execute function app.guard_profile();

-- Access requests come from the public form; only administrators read them.
create policy send_request on public.access_requests for insert to anon, authenticated
  with check (state = 'pending' and reviewed_by is null and reviewed_at is null);
create policy manage_requests on public.access_requests for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Suggestions: a member sends their own and follows them; administrators
-- answer them.
create policy send_suggestion on public.suggestions for insert to authenticated
  with check (
    app.is_member()
    and author_id = auth.uid()
    and state = 'sent'
    and admin_reply is null
    and reviewed_by is null
    and reviewed_at is null
  );
create policy read_own_suggestions on public.suggestions for select to authenticated
  using (author_id = auth.uid() or app.is_admin());
create policy manage_suggestions on public.suggestions for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy read_journal on public.audit_log for select to authenticated
  using (app.is_admin());

-- ── The public tree ────────────────────────────────────────────────────────

-- Everyone in the published tree. For visitors, a living person keeps a
-- place in the tree but nothing else: no name, no date, no slug.
create function public.tree_people()
returns table (
  id uuid,
  slug text,
  given_names text,
  surname text,
  epithet text,
  sex public.sex,
  birth_date date,
  birth_precision public.date_precision,
  death_date date,
  death_precision public.date_precision,
  deceased boolean,
  branch_id uuid,
  portrait_id uuid,
  hidden boolean
)
language sql stable security definer set search_path = ''
as $$
  with viewer as (
    select app.is_admin() as admin, app.is_member() as member
  )
  select
    p.id,
    case when h.hidden then null else p.slug::text end,
    case when h.hidden then null else p.given_names end,
    case when h.hidden then null else p.surname end,
    case when h.hidden then null else p.epithet end,
    case when h.hidden then null else p.sex end,
    case when h.hidden then null else p.birth_date end,
    case when h.hidden then null else p.birth_precision end,
    case when h.hidden then null else p.death_date end,
    case when h.hidden then null else p.death_precision end,
    case when h.hidden then null else p.deceased end,
    p.branch_id,
    case when h.hidden then null else p.portrait_id end,
    h.hidden
  from public.people p
  cross join viewer v
  cross join lateral (
    select not v.admin and not v.member
      and app.is_living(p.deceased, p.birth_date, p.birth_precision, p.death_date)
      as hidden
  ) h
  where v.admin or p.status = 'published'
$$;

-- The links between the people of tree_people(). Marriage dates of a union
-- with a hidden person are hidden too.
create function public.tree_links()
returns table (
  kind text,
  from_id uuid,
  to_id uuid,
  union_id uuid,
  union_order smallint,
  marriage_date date,
  marriage_precision public.date_precision,
  certainty public.certainty
)
language sql stable security definer set search_path = ''
as $$
  with viewer as (
    select app.is_admin() as admin, app.is_member() as member
  ),
  shown as (
    select p.id,
      not v.admin and not v.member
        and app.is_living(p.deceased, p.birth_date, p.birth_precision, p.death_date) as hidden
    from public.people p cross join viewer v
    where v.admin or p.status = 'published'
  )
  select 'parent', pc.parent_id, pc.child_id, pc.union_id, null::smallint,
         null::date, null::public.date_precision, pc.certainty
  from public.parent_child pc
  cross join viewer v
  join shown a on a.id = pc.parent_id
  join shown b on b.id = pc.child_id
  where v.admin or pc.status = 'published'
  union all
  select 'union', u.partner_a, u.partner_b, u.id, u.union_order,
         case when a.hidden or coalesce(b.hidden, false) then null else u.marriage_date end,
         case when a.hidden or coalesce(b.hidden, false) then null else u.marriage_precision end,
         u.certainty
  from public.unions u
  cross join viewer v
  join shown a on a.id = u.partner_a
  left join shown b on b.id = u.partner_b
  where (v.admin or u.status = 'published')
    and (u.partner_b is null or b.id is not null)
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────

-- Start from nothing (Supabase grants everything by default), then open what
-- each role needs. Row level security does the rest.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

grant usage on schema public, app to anon, authenticated;
grant execute on all functions in schema app to anon, authenticated;
grant execute on function public.tree_people(), public.tree_links() to anon, authenticated;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
revoke delete on public.profiles from authenticated;
revoke insert on public.profiles from authenticated;
revoke select on public.profiles, public.invitations, public.access_requests,
  public.suggestions, public.audit_log from anon;
grant insert on public.access_requests to anon;

grant usage on schema private to service_role;
grant all on all tables in schema public, private to service_role;
grant execute on all functions in schema public, app to service_role;

-- ── Journal and timestamps ─────────────────────────────────────────────────

-- Writes one journal line per change, with the old and the new row, so that
-- any change can be reviewed and undone (sections 5 and 7).
create function app.audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_key jsonb;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then
    return null;
  end if;

  select jsonb_object_agg(a.attname, row_data -> a.attname::text)
  into row_key
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
  where i.indrelid = tg_relid and i.indisprimary;

  insert into public.audit_log (actor_id, table_name, row_key, action, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(row_key, '{}'),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end
$$;

create function app.touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'audit_log'
  loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function app.audit()', t.relname);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t.relname and column_name = 'updated_at'
    ) then
      execute format(
        'create trigger touch before update on public.%I
           for each row execute function app.touch()', t.relname);
    end if;
  end loop;
end
$$;
