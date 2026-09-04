-- GITADORA Skill Simulator 4.15.5
-- 空白だけを補正。曲・スコア・依頼データの統合や書き換えは行わない。
-- v29以降のDBへ適用。関数変更に伴い式索引を必ず再構築する。
begin;

drop index if exists public.songs_version_part_normalized_title_idx;

create or replace function public.canonicalize_song_title_spacing(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(coalesce(p_title, ''),
      chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160) || chr(12288),
      repeat(' ', 7)),
    ' +', ' ', 'g'
  ));
$$;

-- 導入済みDBには引数名がp_valueの版とp_titleの版がある。
-- 既存の引数宣言を保持し、本文は位置引数で参照する。
-- DROP FUNCTIONは行わず、依存するRPC・索引を維持する。
do $migration$
declare
  existing_arguments text;
begin
  select pg_catalog.pg_get_function_arguments(
    pg_catalog.to_regprocedure('public.normalize_song_title_for_match(text)')
  ) into existing_arguments;

  execute format($ddl$
    create or replace function public.normalize_song_title_for_match(%s)
    returns text
    language sql
    immutable
    set search_path = ''
    as $body$
      select public.canonicalize_song_title_spacing($1);
    $body$;
  $ddl$, coalesce(existing_arguments, 'p_value text'));
end;
$migration$;

revoke all on function public.canonicalize_song_title_spacing(text) from public, anon, authenticated;
revoke all on function public.normalize_song_title_for_match(text) from public, anon, authenticated;

create index songs_version_part_normalized_title_idx
  on public.songs(version_id, part, public.normalize_song_title_for_match(title));

-- 別曲の大文字小文字違いの申請を拒否しない。
drop index if exists public.song_requests_pending_unique;
create unique index song_requests_pending_unique
  on public.song_requests(requester_id, version_id, title, part)
  where status = 'pending' and request_type = 'new_song';

-- オプション・非公開コメントの前バージョン引継ぎも同じ照合規則に揃える。
create or replace function public.get_my_previous_score_settings(
  p_title text,
  p_part text,
  p_version_id uuid
)
returns table(
  play_option text,
  private_comment text
)
language sql
stable
security definer
set search_path = ''
as $$
with target_version as (
  select gv.sort_order
  from public.game_versions gv
  where gv.id = p_version_id
),
history as (
  select
    case
      when p_part like '%-D' then 'NORMAL'
      else coalesce(nullif(us.play_option, ''), 'NORMAL')
    end as play_option,
    us.private_comment,
    source_version.sort_order,
    us.updated_at
  from public.user_scores us
  left join public.songs s on s.id = us.song_id
  left join public.song_requests sr on sr.id = us.song_request_id
  join public.game_versions source_version
    on source_version.id = coalesce(s.version_id, sr.version_id)
  cross join target_version target
  where us.user_id = auth.uid()
    and public.normalize_song_title_for_match(coalesce(s.title, sr.title)) = public.normalize_song_title_for_match(p_title)
    and coalesce(s.part, sr.part) = p_part
    and source_version.sort_order < target.sort_order
)
select
  history.play_option,
  history.private_comment
from history
order by history.sort_order desc, history.updated_at desc
limit 1;
$$;

revoke all on function public.get_my_previous_score_settings(text,text,uuid) from public, anon;
grant execute on function public.get_my_previous_score_settings(text,text,uuid) to authenticated;

do $$
begin
  if public.normalize_song_title_for_match('FIREBALL') = public.normalize_song_title_for_match('Fireball')
     or public.normalize_song_title_for_match('Ａ') = public.normalize_song_title_for_match('A')
     or public.normalize_song_title_for_match('〜') = public.normalize_song_title_for_match('~')
     or public.normalize_song_title_for_match(' A' || chr(12288) || ' B ') <> 'A B'
  then
    raise exception '曲名照合の検証に失敗しました。';
  end if;
end;
$$;

commit;
