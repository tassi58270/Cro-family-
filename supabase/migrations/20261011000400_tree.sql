-- The family tree (cahier des charges, 6.2): where it opens, and the lineage
-- shown link by link with its proofs (« Voir la démonstration »).

-- Entry points: « Depuis les rois de Hongrie », « Depuis la Picardie »…
-- Each one opens the tree on a person. The default one opens first.
create table public.tree_entry_points (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tree_entry_points_one_default
  on public.tree_entry_points (is_default) where is_default;

create table public.tree_entry_points_i18n (
  entry_id uuid not null references public.tree_entry_points (id) on delete cascade,
  locale public.locale not null,
  label text not null,
  translation public.translation_state not null default 'original',
  primary key (entry_id, locale)
);

-- A line of descent from one person to another, shown step by step with the
-- proof of each step: the Hungarian ancestry is the first use of it.
create table public.lineages (
  id uuid primary key default gen_random_uuid(),
  start_person_id uuid not null references public.people (id) on delete cascade,
  end_person_id uuid not null references public.people (id) on delete cascade,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_person_id <> end_person_id)
);

create table public.lineages_i18n (
  lineage_id uuid not null references public.lineages (id) on delete cascade,
  locale public.locale not null,
  title text not null,
  -- One honest sentence about the debate, when there is one (section 2).
  intro text,
  translation public.translation_state not null default 'original',
  primary key (lineage_id, locale)
);

-- Two fictional coats of arms for the demonstration family « Exemple »
-- (components/heraldique/shield.tsx), so that the tree shows its shields.
alter table public.arms drop constraint arms_builtin_check;
alter table public.arms add constraint arms_builtin_check
  check (builtin in ('croy', 'croy-renty', 'hongrie-ancienne', 'exemple', 'exemple-modele'));

alter table public.tree_entry_points enable row level security;
alter table public.tree_entry_points_i18n enable row level security;
alter table public.lineages enable row level security;
alter table public.lineages_i18n enable row level security;

-- An entry point or a lineage is shown only if its people are visible.
create policy read_published on public.tree_entry_points for select to anon, authenticated
  using (app.is_admin() or (status = 'published' and app.person_is_visible(person_id)));
create policy read_published on public.lineages for select to anon, authenticated
  using (
    app.is_admin()
    or (
      status = 'published'
      and app.person_is_visible(start_person_id)
      and app.person_is_visible(end_person_id)
    )
  );
create policy read_with_parent on public.tree_entry_points_i18n for select to anon, authenticated
  using (exists (select 1 from public.tree_entry_points x where x.id = entry_id));
create policy read_with_parent on public.lineages_i18n for select to anon, authenticated
  using (exists (select 1 from public.lineages x where x.id = lineage_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'tree_entry_points', 'tree_entry_points_i18n', 'lineages', 'lineages_i18n'
  ] loop
    execute format(
      'create policy admin_writes on public.%I for all to authenticated
         using (app.is_admin()) with check (app.is_admin())', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function app.audit()', t);
  end loop;
  foreach t in array array['tree_entry_points', 'lineages'] loop
    execute format(
      'create trigger touch before update on public.%I
         for each row execute function app.touch()', t);
  end loop;
end
$$;
