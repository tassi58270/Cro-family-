-- Schema of the family site (cahier des charges, section 5, « Modèle de données »).
--
-- Conventions
--   * Every piece of content has a status: draft, pending (« à valider »),
--     published or rejected. Only published content reaches the public site.
--   * Dates accept imprecision: a date plus its precision (day, month, year,
--     about, before, after). « vers 1385 » is 1385-01-01 with precision about.
--   * Texts that change with the language live in *_i18n tables, one row per
--     language. French is the reference; a missing row falls back on it.
--   * is_demo marks the visibly fictional demonstration data (step 4), so that
--     it can be removed in one click.
--   * Access rules (row level security) are in the next migration.

create extension if not exists citext with schema extensions;

create schema if not exists app;
create schema if not exists private;

-- ── Types ──────────────────────────────────────────────────────────────────

create type public.content_status as enum ('draft', 'pending', 'published', 'rejected');
create type public.date_precision as enum ('day', 'month', 'year', 'about', 'before', 'after');
create type public.locale as enum ('fr', 'en', 'de');
-- original: written in this language; machine: automatic translation still to
-- be reviewed (« à relire »); reviewed: translation checked by the family.
create type public.translation_state as enum ('original', 'machine', 'reviewed');
create type public.sex as enum ('female', 'male', 'unknown');
-- How sure a link of the tree is: proven by a document, family tradition, or
-- debated by historians (section 5, « Preuves et niveau de certitude »).
create type public.certainty as enum ('attested', 'tradition', 'debated');
create type public.member_role as enum ('member', 'admin');
create type public.branch_state as enum ('extant', 'extinct');
create type public.place_kind as enum ('castle', 'town', 'estate', 'battlefield', 'church', 'other');
create type public.event_kind as enum ('birth', 'marriage', 'death', 'title', 'battle', 'acquisition', 'extinction', 'other');
create type public.story_theme as enum ('war', 'court', 'travel', 'love', 'daily');
create type public.media_kind as enum ('photo', 'portrait', 'painting', 'engraving', 'document', 'arms');
create type public.source_kind as enum ('document', 'book', 'archive', 'website', 'oral', 'other');
create type public.suggestion_kind as enum ('correction', 'person', 'photo', 'story', 'place', 'event', 'identification');
create type public.suggestion_state as enum ('sent', 'reviewing', 'accepted', 'rejected');
create type public.request_state as enum ('pending', 'approved', 'rejected');
create type public.filiation_kind as enum ('biological', 'adoptive');

create domain public.slug as text
  check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) <= 120);

-- ── Accounts (private: never readable through the site's roles) ────────────

create table private.accounts (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table private.sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references private.accounts (id) on delete cascade,
  -- Only a hash of the cookie value is stored.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text
);
create index on private.sessions (account_id);

-- Magic links and invitations: single use, short-lived, stored as hashes.
create table private.login_tokens (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  token_hash text not null unique,
  purpose text not null check (purpose in ('login', 'invitation')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index on private.login_tokens (email, created_at desc);

-- ── Places, branches, people ───────────────────────────────────────────────

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  kind public.place_kind not null default 'other',
  country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  period_start smallint,
  period_end smallint,
  -- « Mention de ce que l'on peut encore visiter aujourd'hui » (6.6).
  visitable boolean not null default false,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

create table public.places_i18n (
  place_id uuid not null references public.places (id) on delete cascade,
  locale public.locale not null,
  name text not null,
  description text,
  visit_info text,
  translation public.translation_state not null default 'original',
  primary key (place_id, locale)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  parent_id uuid references public.branches (id) on delete set null,
  founder_id uuid,
  state public.branch_state not null default 'extant',
  extinct_male_year smallint,
  extinct_female_year smallint,
  -- Colour of its lines in the tree, a shade of red or grey.
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create table public.branches_i18n (
  branch_id uuid not null references public.branches (id) on delete cascade,
  locale public.locale not null,
  name text not null,
  description text,
  -- What became of the titles and lands when the branch died out.
  fate text,
  translation public.translation_state not null default 'original',
  primary key (branch_id, locale)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  given_names text,
  surname text,
  -- Nickname such as « le Grand ».
  epithet text,
  sex public.sex not null default 'unknown',
  birth_date date,
  birth_precision public.date_precision,
  birth_place_id uuid references public.places (id) on delete set null,
  death_date date,
  death_precision public.date_precision,
  death_place_id uuid references public.places (id) on delete set null,
  -- « Décédée » ticked by an administrator when no date is known.
  deceased boolean not null default false,
  branch_id uuid references public.branches (id) on delete set null,
  -- Family of origin of someone who married into the family.
  origin_family text,
  origin_arms_id uuid,
  portrait_id uuid,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((birth_date is null) = (birth_precision is null)),
  check ((death_date is null) = (death_precision is null)),
  check (death_date is null or birth_date is null or death_date >= birth_date)
);
create index on public.people (branch_id);
create index on public.people (surname, given_names);

alter table public.branches
  add foreign key (founder_id) references public.people (id) on delete set null;

create table public.people_i18n (
  person_id uuid not null references public.people (id) on delete cascade,
  locale public.locale not null,
  -- Name as written in this language, when it differs (Croÿ, Croy).
  display_name text,
  biography text,
  -- « Rôles et fonctions : charges, commandements, ambassades ».
  roles text,
  -- « Travaux et réalisations : constructions, écrits, fondations ».
  works text,
  translation public.translation_state not null default 'original',
  primary key (person_id, locale)
);

create table public.unions (
  id uuid primary key default gen_random_uuid(),
  partner_a uuid not null references public.people (id) on delete cascade,
  partner_b uuid references public.people (id) on delete cascade,
  marriage_date date,
  marriage_precision public.date_precision,
  place_id uuid references public.places (id) on delete set null,
  -- 1 for a first marriage, 2 for a second…
  union_order smallint not null default 1 check (union_order > 0),
  certainty public.certainty not null default 'attested',
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (partner_a is distinct from partner_b),
  check ((marriage_date is null) = (marriage_precision is null))
);
create index on public.unions (partner_a);
create index on public.unions (partner_b);

create table public.parent_child (
  parent_id uuid not null references public.people (id) on delete cascade,
  child_id uuid not null references public.people (id) on delete cascade,
  -- The union the child was born of, when known.
  union_id uuid references public.unions (id) on delete set null,
  kind public.filiation_kind not null default 'biological',
  certainty public.certainty not null default 'attested',
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);
create index on public.parent_child (child_id);

-- ── Titles and arms ────────────────────────────────────────────────────────

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  created_date date,
  created_precision public.date_precision,
  -- Who granted it, as written (a sovereign, an act).
  creator text,
  branch_id uuid references public.branches (id) on delete set null,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((created_date is null) = (created_precision is null))
);

create table public.titles_i18n (
  title_id uuid not null references public.titles (id) on delete cascade,
  locale public.locale not null,
  name text not null,
  description text,
  translation public.translation_state not null default 'original',
  primary key (title_id, locale)
);

create table public.people_titles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  start_date date,
  start_precision public.date_precision,
  end_date date,
  end_precision public.date_precision,
  -- 7 for the 7th duke.
  rank smallint check (rank > 0),
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((start_date is null) = (start_precision is null)),
  check ((end_date is null) = (end_precision is null))
);
create index on public.people_titles (person_id);
create index on public.people_titles (title_id);

-- ── Media and albums ───────────────────────────────────────────────────────

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  cover_id uuid,
  event_id uuid,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.albums_i18n (
  album_id uuid not null references public.albums (id) on delete cascade,
  locale public.locale not null,
  title text not null,
  description text,
  translation public.translation_state not null default 'original',
  primary key (album_id, locale)
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  -- Path of the original file in storage; sizes are derived from it.
  storage_path text not null unique,
  kind public.media_kind not null default 'photo',
  mime_type text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  bytes integer check (bytes > 0),
  credit text,
  -- Author or provenance of the picture.
  provenance text,
  -- Permission to publish, as given by the family.
  rights text,
  taken_date date,
  taken_precision public.date_precision,
  place_id uuid references public.places (id) on delete set null,
  event_id uuid,
  album_id uuid references public.albums (id) on delete set null,
  -- Someone on it is not identified yet (album « Qui est-ce ? »).
  unidentified boolean not null default false,
  uploaded_by uuid,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((taken_date is null) = (taken_precision is null))
);
create index on public.media (album_id);

create table public.media_i18n (
  media_id uuid not null references public.media (id) on delete cascade,
  locale public.locale not null,
  caption text,
  alt text,
  translation public.translation_state not null default 'original',
  primary key (media_id, locale)
);

-- Who is on a picture, with the area of their face (x, y, width, height as
-- fractions of the picture) to highlight it.
create table public.media_people (
  media_id uuid not null references public.media (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  box real[] check (box is null or cardinality(box) = 4),
  primary key (media_id, person_id)
);
create index on public.media_people (person_id);

alter table public.people
  add foreign key (portrait_id) references public.media (id) on delete set null;
alter table public.albums
  add foreign key (cover_id) references public.media (id) on delete set null;

create table public.arms (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  -- Arms drawn for the project (components/heraldique), or an uploaded SVG.
  builtin text check (builtin in ('croy', 'croy-renty', 'hongrie-ancienne')),
  svg_id uuid references public.media (id) on delete set null,
  period_start smallint,
  period_end smallint,
  branch_id uuid references public.branches (id) on delete set null,
  person_id uuid references public.people (id) on delete set null,
  -- For allied families: the family these arms stand for.
  family_name text,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.arms_i18n (
  arms_id uuid not null references public.arms (id) on delete cascade,
  locale public.locale not null,
  name text not null,
  -- The heraldic description, then the same in plain words.
  blazon text,
  explanation text,
  translation public.translation_state not null default 'original',
  primary key (arms_id, locale)
);

alter table public.people
  add foreign key (origin_arms_id) references public.arms (id) on delete set null;

-- ── Events and stories ─────────────────────────────────────────────────────

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  kind public.event_kind not null default 'other',
  event_date date,
  event_precision public.date_precision,
  place_id uuid references public.places (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((event_date is null) = (event_precision is null))
);
create index on public.events (place_id);

create table public.events_i18n (
  event_id uuid not null references public.events (id) on delete cascade,
  locale public.locale not null,
  title text not null,
  description text,
  translation public.translation_state not null default 'original',
  primary key (event_id, locale)
);

alter table public.media
  add foreign key (event_id) references public.events (id) on delete set null;
alter table public.albums
  add foreign key (event_id) references public.events (id) on delete set null;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  era_start smallint,
  era_end smallint,
  author_id uuid,
  -- Shown under the story unless the author prefers to stay anonymous.
  author_name text,
  anonymous boolean not null default false,
  source text,
  themes public.story_theme[] not null default '{}',
  original_locale public.locale not null default 'fr',
  featured boolean not null default false,
  cover_id uuid references public.media (id) on delete set null,
  published_at timestamptz,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.stories (author_id);

create table public.stories_i18n (
  story_id uuid not null references public.stories (id) on delete cascade,
  locale public.locale not null,
  title text not null,
  excerpt text,
  body text,
  translation public.translation_state not null default 'original',
  primary key (story_id, locale)
);

-- Links between contents: created once, shown on both sides (section 5).
create table public.story_people (
  story_id uuid not null references public.stories (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (story_id, person_id)
);
create index on public.story_people (person_id);

create table public.story_places (
  story_id uuid not null references public.stories (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  primary key (story_id, place_id)
);
create index on public.story_places (place_id);

create table public.story_events (
  story_id uuid not null references public.stories (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  primary key (story_id, event_id)
);
create index on public.story_events (event_id);

create table public.event_people (
  event_id uuid not null references public.events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text,
  primary key (event_id, person_id)
);
create index on public.event_people (person_id);

create table public.place_people (
  place_id uuid not null references public.places (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text,
  primary key (place_id, person_id)
);
create index on public.place_people (person_id);

-- ── Sources and proofs ─────────────────────────────────────────────────────

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  kind public.source_kind not null default 'document',
  title text not null,
  reference text,
  -- Archive or library holding the original.
  repository text,
  url text,
  -- The digitised document.
  document_id uuid references public.media (id) on delete set null,
  transcription text,
  translation text,
  status public.content_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_sources (
  source_id uuid not null references public.sources (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  note text,
  primary key (source_id, person_id)
);
create index on public.person_sources (person_id);

create table public.union_sources (
  source_id uuid not null references public.sources (id) on delete cascade,
  union_id uuid not null references public.unions (id) on delete cascade,
  note text,
  primary key (source_id, union_id)
);
create index on public.union_sources (union_id);

create table public.filiation_sources (
  source_id uuid not null references public.sources (id) on delete cascade,
  parent_id uuid not null,
  child_id uuid not null,
  note text,
  primary key (source_id, parent_id, child_id),
  foreign key (parent_id, child_id)
    references public.parent_child (parent_id, child_id) on delete cascade
);
create index on public.filiation_sources (parent_id, child_id);

-- ── Members, suggestions, journal ──────────────────────────────────────────

create table public.profiles (
  id uuid primary key references private.accounts (id) on delete cascade,
  display_name text,
  role public.member_role not null default 'member',
  -- The person of the tree this member is.
  person_id uuid references public.people (id) on delete set null,
  preferred_locale public.locale not null default 'fr',
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  full_name text not null,
  -- How they are related to the family, in their own words.
  relation text not null,
  message text,
  state public.request_state not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  role public.member_role not null default 'member',
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.suggestion_kind not null,
  -- The content it is about, when there is one.
  target_table text,
  target_id uuid,
  -- The proposed content, compared with the current one in the dashboard.
  payload jsonb not null default '{}',
  attachments uuid[] not null default '{}',
  source text,
  state public.suggestion_state not null default 'sent',
  admin_reply text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.suggestions (author_id);
create index on public.suggestions (state, created_at);

-- Who changed what, when, with the old and new values (section 5).
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  table_name text not null,
  row_key jsonb not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  reverted_at timestamptz,
  reverted_by uuid
);
create index on public.audit_log (table_name, at desc);
create index on public.audit_log (actor_id, at desc);
