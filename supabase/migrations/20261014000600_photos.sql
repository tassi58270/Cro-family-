-- Photos (cahier des charges, 6.5).

-- « Chacun peut demander le retrait d'une photo où il figure. »
alter type public.suggestion_kind add value if not exists 'removal';

-- Photos placed in a story by its author.
create table public.story_media (
  story_id uuid not null references public.stories (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  position smallint not null default 0,
  primary key (story_id, media_id)
);
create index on public.story_media (media_id);

alter table public.story_media enable row level security;

create policy read_links on public.story_media for select to anon, authenticated
  using (
    exists (select 1 from public.stories x where x.id = story_id)
    and exists (select 1 from public.media x where x.id = media_id)
  );
create policy admin_writes on public.story_media for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- An author adds to their draft only photos they may see.
create policy write_own_story on public.story_media for all to authenticated
  using (app.is_own_draft_story(story_id))
  with check (
    app.is_own_draft_story(story_id)
    and exists (select 1 from public.media x where x.id = media_id)
  );

grant select on public.story_media to anon, authenticated;
grant insert, update, delete on public.story_media to authenticated;
grant all on public.story_media to service_role;
create trigger audit after insert or update or delete on public.story_media
  for each row execute function app.audit();

-- The wall of photos is read by date and state.
create index on public.media (status, taken_date);
create index on public.media (unidentified) where unidentified;
