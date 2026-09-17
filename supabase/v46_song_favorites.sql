-- ユーザー・バージョンごとの3つの曲お気に入りリスト。
begin;

create table if not exists public.song_favorite_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id uuid not null references public.game_versions(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  primary key (user_id, version_id, slot)
);

create table if not exists public.song_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id uuid not null references public.game_versions(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  song_title text not null check (char_length(btrim(song_title)) between 1 and 500),
  primary key (user_id, version_id, slot, song_title)
);

create index if not exists song_favorites_owner_version_idx
  on public.song_favorites (user_id, version_id);

alter table public.song_favorite_lists enable row level security;
alter table public.song_favorites enable row level security;

drop policy if exists song_favorite_lists_select on public.song_favorite_lists;
drop policy if exists song_favorite_lists_insert on public.song_favorite_lists;
drop policy if exists song_favorite_lists_update on public.song_favorite_lists;
drop policy if exists song_favorites_select on public.song_favorites;
drop policy if exists song_favorites_insert on public.song_favorites;
drop policy if exists song_favorites_delete on public.song_favorites;

create policy song_favorite_lists_select on public.song_favorite_lists
  for select to authenticated using (user_id = (select auth.uid()));
create policy song_favorite_lists_insert on public.song_favorite_lists
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy song_favorite_lists_update on public.song_favorite_lists
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy song_favorites_select on public.song_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy song_favorites_insert on public.song_favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy song_favorites_delete on public.song_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update on public.song_favorite_lists to authenticated;
grant select, insert, delete on public.song_favorites to authenticated;
commit;
