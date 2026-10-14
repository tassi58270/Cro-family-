-- Step 11: the journal and going back (cahier des charges, section 7).
-- One change is everything one transaction wrote: saving a person writes the
-- person and their texts; deleting it removes, by cascade, all its links.
-- Undoing a change undoes all of it.

-- Which change an entry undoes, so that the journal can say « annulation ».
alter table public.audit_log add column undoes timestamptz;
create index on public.audit_log (at desc);

create or replace function app.audit() returns trigger
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

  insert into public.audit_log (actor_id, table_name, row_key, action, old_data, new_data, undoes)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(row_key, '{}'),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('app.undoing', true), '')::timestamptz
  );
  return null;
end
$$;

-- « (t.a, t.b) » and « (r.a, r.b) » for the given columns.
create function app.columns_of(alias text, cols text[]) returns text
language sql immutable set search_path = ''
as $$
  select string_agg(format('%I.%I', alias, c), ', ') from unnest(cols) c
$$;

-- Undoes one change (all the entries of one transaction by one person),
-- newest first. Refused when a later change, other than an undo, touched the
-- same rows: it would be silently lost; undo that one first.
create function public.undo_change(change_at timestamptz, change_actor uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  e record;
  keys text[];
  cols text[];
  done integer := 0;
  pending bigint[] := '{}';
  remaining bigint[];
  progress boolean;
  entry bigint;
begin
  if not app.is_admin() then
    raise exception 'administrators only' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.audit_log l
    where l.at > change_at and l.reverted_at is null and l.undoes is null
      and (l.table_name, l.row_key) in (
        select c.table_name, c.row_key from public.audit_log c
        where c.at = change_at and c.actor_id is not distinct from change_actor
      )
  ) then
    raise exception 'changed since' using errcode = 'P0001';
  end if;

  perform set_config('app.undoing', change_at::text, true);

  -- Deleted rows come back first (parents before children, whatever the
  -- order they left in): what was updated or added may point at them.
  select array_agg(id order by id) into pending from public.audit_log
  where at = change_at and actor_id is not distinct from change_actor
    and reverted_at is null and action = 'delete';
  while coalesce(array_length(pending, 1), 0) > 0 loop
    remaining := '{}';
    progress := false;
    foreach entry in array pending loop
      select * into e from public.audit_log where id = entry;
      begin
        execute format(
          'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
          e.table_name, e.table_name
        ) using e.old_data;
        progress := true;
        done := done + 1;
      exception when foreign_key_violation then
        remaining := remaining || entry;
      end;
    end loop;
    if not progress then
      raise exception 'cannot restore' using errcode = 'P0001';
    end if;
    pending := remaining;
  end loop;

  for e in
    select * from public.audit_log
    where at = change_at and actor_id is not distinct from change_actor
      and reverted_at is null and action <> 'delete'
    order by id desc
  loop
    keys := array(select jsonb_object_keys(e.row_key));
    if e.action = 'insert' then
      execute format(
        'delete from public.%I t where (%s) = (select %s from jsonb_populate_record(null::public.%I, $1) r)',
        e.table_name, app.columns_of('t', keys), app.columns_of('r', keys), e.table_name
      ) using e.row_key;
    else
      -- Key columns too: an update may have moved the row to another key
      -- (row_key is the new one).
      cols := array(
        select k from jsonb_object_keys(e.old_data) k
        where k not in ('created_at', 'updated_at')
      );
      if array_length(cols, 1) > 0 then
        execute format(
          'update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1) r)
           where (%s) = (select %s from jsonb_populate_record(null::public.%I, $2) r)',
          e.table_name, array_to_string(array(select format('%I', c) from unnest(cols) c), ', '),
          app.columns_of('r', cols), e.table_name,
          app.columns_of('t', keys), app.columns_of('r', keys), e.table_name
        ) using e.old_data, e.row_key;
      end if;
    end if;
    done := done + 1;
  end loop;

  update public.audit_log set reverted_at = now(), reverted_by = auth.uid()
  where at = change_at and actor_id is not distinct from change_actor and reverted_at is null;
  return done;
end
$$;
revoke all on function public.undo_change(timestamptz, uuid) from public, anon;
grant execute on function public.undo_change(timestamptz, uuid) to authenticated;
