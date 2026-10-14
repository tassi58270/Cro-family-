-- Step 11: merging duplicates (cahier des charges, section 7, « Personnes »).
-- Everything that points at the duplicate is moved to the person kept; what
-- the kept person lacks (dates, places, portrait…) is taken from the
-- duplicate; then the duplicate is deleted. One transaction: the journal can
-- undo it as a whole.

create function public.merge_people(keep uuid, duplicate uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  fk record;
  others text[];
begin
  if not app.is_admin() then
    raise exception 'administrators only' using errcode = '42501';
  end if;
  if keep = duplicate then
    raise exception 'same person' using errcode = '22023';
  end if;
  if not exists (select 1 from public.people where id = keep)
     or not exists (select 1 from public.people where id = duplicate) then
    raise exception 'unknown person' using errcode = '22023';
  end if;

  -- What the kept person lacks comes from the duplicate.
  update public.people k set
    given_names = coalesce(k.given_names, d.given_names),
    surname = coalesce(k.surname, d.surname),
    epithet = coalesce(k.epithet, d.epithet),
    birth_date = coalesce(k.birth_date, d.birth_date),
    birth_precision = case when k.birth_date is null then d.birth_precision else k.birth_precision end,
    birth_place_id = coalesce(k.birth_place_id, d.birth_place_id),
    death_date = coalesce(k.death_date, d.death_date),
    death_precision = case when k.death_date is null then d.death_precision else k.death_precision end,
    death_place_id = coalesce(k.death_place_id, d.death_place_id),
    deceased = k.deceased or d.deceased,
    branch_id = coalesce(k.branch_id, d.branch_id),
    origin_family = coalesce(k.origin_family, d.origin_family),
    origin_arms_id = coalesce(k.origin_arms_id, d.origin_arms_id),
    portrait_id = coalesce(k.portrait_id, d.portrait_id),
    sex = case when k.sex = 'unknown' then d.sex else k.sex end
  from public.people d
  where k.id = keep and d.id = duplicate;

  -- Links between the two would become a person linked to themselves.
  delete from public.unions
  where (partner_a = keep and partner_b = duplicate) or (partner_a = duplicate and partner_b = keep);
  delete from public.parent_child
  where (parent_id = keep and child_id = duplicate) or (parent_id = duplicate and child_id = keep);

  -- Every column that points at a person.
  for fk in
    select c.conrelid::regclass::text as tbl, a.attname as col, c.conrelid
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.people'::regclass
      and array_length(c.conkey, 1) = 1 and c.conrelid <> 'public.people'::regclass
  loop
    -- The other columns of the primary key, to avoid creating a duplicate row.
    select array_agg(pa.attname::text) into others
    from pg_index i
    join pg_attribute pa on pa.attrelid = i.indrelid and pa.attnum = any (i.indkey)
    where i.indrelid = fk.conrelid and i.indisprimary and pa.attname <> fk.col;

    if others is not null and fk.col = any (
      select pa.attname::text from pg_index i
      join pg_attribute pa on pa.attrelid = i.indrelid and pa.attnum = any (i.indkey)
      where i.indrelid = fk.conrelid and i.indisprimary
    ) then
      execute format(
        'delete from %s t where t.%I = $2 and exists (select 1 from %s x where x.%I = $1 and (%s) = (%s))',
        fk.tbl, fk.col, fk.tbl, fk.col,
        app.columns_of('x', others), app.columns_of('t', others)
      ) using keep, duplicate;
    end if;
    execute format('update %s set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col)
      using keep, duplicate;
  end loop;

  delete from public.people where id = duplicate;
end
$$;
revoke all on function public.merge_people(uuid, uuid) from public, anon;
grant execute on function public.merge_people(uuid, uuid) to authenticated;
