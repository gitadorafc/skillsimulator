-- 4.15.6 / v35の修正版を適用後に実行。
-- 全バージョンの曲名の空白を統一する。曲ID・スコア参照は変更しない。
begin;
lock table public.songs, public.song_requests in share row exclusive mode;

do $$
declare collisions text;
begin
  if public.normalize_song_title_for_match('FIREBALL') = public.normalize_song_title_for_match('Fireball') then
    raise exception '先にv35の修正版SQLを実行してください。大文字小文字の区別が未適用です。';
  end if;
  select string_agg(format('%s / %s / %s (IDs: %s)', version_id, title_key, part, ids), E'\n')
  into collisions
  from (
    select version_id, public.canonicalize_song_title_spacing(title) as title_key, part,
           string_agg(id::text, ', ' order by id) as ids
    from public.songs
    group by version_id, public.canonicalize_song_title_spacing(title), part
    having count(*) > 1
    limit 20
  ) duplicates;
  if collisions is not null then
    raise exception '空白統一で曲マスターが重複するため、変更せず中止しました。'
      using detail = collisions, hint = '表示されたIDを確認してください。自動統合・削除はしません。';
  end if;

  select string_agg(format('%s / %s / %s (IDs: %s)', version_id, title_key, part, ids), E'\n')
  into collisions
  from (
    select requester_id, version_id, public.canonicalize_song_title_spacing(title) as title_key, part,
           string_agg(id::text, ', ' order by id) as ids
    from public.song_requests
    where status = 'pending' and request_type = 'new_song'
    group by requester_id, version_id, public.canonicalize_song_title_spacing(title), part
    having count(*) > 1
    limit 20
  ) duplicates;
  if collisions is not null then
    raise exception '空白統一で未処理依頼が重複するため、変更せず中止しました。'
      using detail = collisions, hint = '依頼を確認・整理してから再実行してください。';
  end if;
end;
$$;

-- 件数確認。続くUPDATEと同じトランザクション内。
select 'songs' as target, count(*) as changed_rows from public.songs
where title is distinct from public.canonicalize_song_title_spacing(title)
union all
select 'song_requests', count(*) from public.song_requests
where title is distinct from public.canonicalize_song_title_spacing(title);

update public.songs
set title = public.canonicalize_song_title_spacing(title)
where title is distinct from public.canonicalize_song_title_spacing(title);

update public.song_requests
set title = public.canonicalize_song_title_spacing(title)
where title is distinct from public.canonicalize_song_title_spacing(title);

-- 旧クライアント・直接CSV取込などでも非統一の曲名を保存しない。
create or replace function public.enforce_song_title_spacing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title is not null then
    new.title := public.canonicalize_song_title_spacing(new.title);
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_song_title_spacing() from public, anon, authenticated;

drop trigger if exists songs_title_spacing on public.songs;
create trigger songs_title_spacing
before insert or update of title on public.songs
for each row execute function public.enforce_song_title_spacing();

drop trigger if exists song_requests_title_spacing on public.song_requests;
create trigger song_requests_title_spacing
before insert or update of title on public.song_requests
for each row execute function public.enforce_song_title_spacing();

commit;
