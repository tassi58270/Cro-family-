-- Home page contents (cahier des charges, section 6.1), all written by the
-- family from the dashboard: the line under the name, the summary, the
-- figures, the chapters of the story and the anecdotes.

-- Anecdotes are short stories shown in « Le saviez-vous ? ».
alter table public.stories add column anecdote boolean not null default false;

-- One row per language. The two lines under « Croÿ » start with the
-- family's own wording (approved on 10 October 2026); English and German are
-- automatic translations, to be reviewed.
create table public.home_i18n (
  locale public.locale primary key,
  tagline text,
  pronunciation text,
  -- « En quelques lignes »: one paragraph per line.
  summary text,
  translation public.translation_state not null default 'original',
  updated_at timestamptz not null default now()
);

insert into public.home_i18n (locale, tagline, pronunciation, translation) values
  ('fr', 'Neuf siècles d’une famille européenne', 'se prononce « croui »', 'original'),
  ('en', 'Nine centuries of a European family', 'pronounced “croo-ee”', 'machine'),
  ('de', 'Neun Jahrhunderte einer europäischen Familie', 'gesprochen „Kru-i“', 'machine');

-- Figures: either a number typed by the family, or one the site counts
-- itself from the tree.
create table public.home_figures (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  value integer check (value >= 0),
  auto text check (auto in ('people', 'generations', 'countries', 'photos', 'branches', 'titles', 'stories', 'places')),
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((value is null) <> (auto is null))
);

create table public.home_figures_i18n (
  figure_id uuid not null references public.home_figures (id) on delete cascade,
  locale public.locale not null,
  label text not null,
  translation public.translation_state not null default 'original',
  primary key (figure_id, locale)
);

-- Chapters of the story told while scrolling, over the map of Europe.
create table public.home_chapters (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  -- « Aux origines, la Hongrie des Árpád », before the first chapter.
  prologue boolean not null default false,
  -- Years the chapter covers: its link opens the tree at that time.
  era_start smallint,
  era_end smallint,
  -- Where the map goes: a place, or coordinates; no place shows all Europe.
  place_id uuid references public.places (id) on delete set null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  -- 1 shows the whole of Europe, 6 a region.
  zoom real not null default 1 check (zoom between 1 and 12),
  image_id uuid references public.media (id) on delete set null,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

create table public.home_chapters_i18n (
  chapter_id uuid not null references public.home_chapters (id) on delete cascade,
  locale public.locale not null,
  -- The giant date: « 1397 », « XIIe–XIVe siècle »…
  date_label text,
  title text not null,
  body text,
  translation public.translation_state not null default 'original',
  primary key (chapter_id, locale)
);

-- ── Access rules, same pattern as the other contents ───────────────────────

alter table public.home_i18n enable row level security;
alter table public.home_figures enable row level security;
alter table public.home_figures_i18n enable row level security;
alter table public.home_chapters enable row level security;
alter table public.home_chapters_i18n enable row level security;

create policy read_home on public.home_i18n for select to anon, authenticated using (true);
create policy read_published on public.home_figures for select to anon, authenticated
  using (status = 'published' or app.is_admin());
create policy read_published on public.home_chapters for select to anon, authenticated
  using (status = 'published' or app.is_admin());
create policy read_with_parent on public.home_figures_i18n for select to anon, authenticated
  using (exists (select 1 from public.home_figures x where x.id = figure_id));
create policy read_with_parent on public.home_chapters_i18n for select to anon, authenticated
  using (exists (select 1 from public.home_chapters x where x.id = chapter_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'home_i18n', 'home_figures', 'home_figures_i18n', 'home_chapters', 'home_chapters_i18n'
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
  foreach t in array array['home_i18n', 'home_figures', 'home_chapters'] loop
    execute format(
      'create trigger touch before update on public.%I
         for each row execute function app.touch()', t);
  end loop;
end
$$;

-- ── Figures the site counts itself ─────────────────────────────────────────

-- Totals over the published tree. Only numbers come out, never a name, so
-- living people can be counted without being shown.
create function public.home_counts() returns jsonb
language sql stable security definer set search_path = ''
as $$
  with recursive
  people as (
    select id from public.people where status = 'published'
  ),
  links as (
    select pc.parent_id, pc.child_id from public.parent_child pc
    join people a on a.id = pc.parent_id
    join people b on b.id = pc.child_id
    where pc.status = 'published'
  ),
  -- Generation of each person, counted from those without known parents.
  generation (person, depth) as (
    select p.id, 1 from people p
    where not exists (select 1 from links l where l.child_id = p.id)
    union
    select l.child_id, g.depth + 1
    from generation g join links l on l.parent_id = g.person
    where g.depth < 80
  )
  select jsonb_build_object(
    'people', (select count(*) from people),
    'generations', coalesce((select max(depth) from generation), 0),
    'countries', (
      select count(distinct pl.country_code) from public.places pl
      where pl.status = 'published' and pl.country_code is not null
    ),
    'photos', (
      select count(*) from public.media
      where status = 'published' and kind in ('photo', 'portrait', 'painting', 'engraving')
    ),
    'branches', (select count(*) from public.branches where status = 'published'),
    'titles', (select count(*) from public.titles where status = 'published'),
    'stories', (select count(*) from public.stories where status = 'published' and not anecdote),
    'places', (select count(*) from public.places where status = 'published')
  )
$$;

revoke all on function public.home_counts() from public;
grant execute on function public.home_counts() to anon, authenticated, service_role;
