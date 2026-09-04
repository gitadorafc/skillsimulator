-- 4.16.0: 自分の同一曲・同一パートのバージョン別コメントと成績。
begin;
create or replace function public.get_my_song_comment_history(
  p_song_id uuid, p_version_id uuid
)
returns table(
  version_id uuid, version_name text, sort_order integer,
  score_id uuid, achievement_rate numeric, fc text, play_option text, private_comment text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  own_user_id uuid := auth.uid();
  song_title text;
  song_part text;
  anchor_order integer;
  anchor_created timestamptz;
begin
  if own_user_id is null then
    raise exception 'ログイン情報を取得できません。';
  end if;
  select s.title, s.part into song_title, song_part
  from public.songs s where s.id = p_song_id;
  if not found then raise exception '対象譜面が見つかりません。'; end if;
  select gv.sort_order, gv.created_at into anchor_order, anchor_created
  from public.game_versions gv where gv.id = p_version_id;
  if not found then raise exception 'バージョンが見つかりません。'; end if;

  return query
  select gv.id, gv.name::text, gv.sort_order,
         record.id, record.achievement_rate::numeric, record.fc::text,
         record.play_option::text, record.private_comment::text
  from public.game_versions gv
  left join lateral (
    select us.id, us.achievement_rate, us.fc, us.play_option, us.private_comment
    from public.user_scores us
    left join public.songs s on s.id = us.song_id
    left join public.song_requests sr on sr.id = us.song_request_id
    where us.user_id = own_user_id
      and coalesce(s.version_id, sr.version_id) = gv.id
      and coalesce(s.part, sr.part) = song_part
      and public.normalize_song_title_for_match(coalesce(s.title, sr.title))
          = public.normalize_song_title_for_match(song_title)
    order by (us.song_id is not null) desc, us.updated_at desc nulls last, us.id
    limit 1
  ) record on true
  where gv.id = p_version_id or gv.sort_order < anchor_order
     or (gv.sort_order = anchor_order and gv.created_at <= anchor_created)
  order by (gv.id = p_version_id) desc, gv.sort_order desc, gv.created_at desc, gv.id;
end;
$$;
revoke all on function public.get_my_song_comment_history(uuid,uuid) from public, anon;
grant execute on function public.get_my_song_comment_history(uuid,uuid) to authenticated;
commit;

