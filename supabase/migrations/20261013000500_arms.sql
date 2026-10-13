-- Arms and branches (cahier des charges, 6.3).

-- Family arms, arms of allied families (shown next to spouses in the tree)
-- and arms of towns that took up the family's (a small final section).
create type public.arms_kind as enum ('family', 'alliance', 'commune');
alter table public.arms add column kind public.arms_kind not null default 'family';

-- Who bore these arms, in the family's words, when no single person or
-- branch says it.
alter table public.arms_i18n add column bearers text;

-- The last representative of an extinct branch.
alter table public.branches
  add column last_person_id uuid references public.people (id) on delete set null;

-- Arms that belong to one person follow that person: never shown to the
-- public while they are alive.
drop policy read_published on public.arms;
create policy read_published on public.arms for select to anon, authenticated
  using (
    app.is_admin()
    or (status = 'published' and (person_id is null or app.person_is_visible(person_id)))
  );
