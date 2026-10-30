-- v4.36.11: U+FF5E FULLWIDTH TILDE と U+301C WAVE DASH だけを同一視する。
-- FIREBALL/Fireball、半角~、(CLASSIC)はそれぞれ別曲として保持。
-- 曲名とスコアの保存データは変更しない。
begin;

-- 同一バージョン・同一パートに同じ照合キーが複数ある場合は中断する。
do $$
declare v_conflicts text;
begin
  select string_agg(format('%s / %s / %s',version_id,part,normalized_title), E'\n') into v_conflicts
  from (
    select version_id, part,
      replace(public.canonicalize_song_title_spacing(title), chr(12316), chr(65374)) as normalized_title
    from public.songs
    group by version_id,part, replace(public.canonicalize_song_title_spacing(title), chr(12316), chr(65374))
    having count(*) > 1
    limit 20
  ) q;
  if v_conflicts is not null then
    raise exception '同一バージョンに波ダッシュ正規化後の重複譜面が存在します。SQLを中止しました。' using detail=v_conflicts;
  end if;
end;
$$;

-- 既存引数名を維持し、依存RPCを壊さずに差し替える。
drop index if exists public.songs_version_part_normalized_title_idx;
do $migration$
declare arguments text;
begin
  select pg_catalog.pg_get_function_arguments(
    pg_catalog.to_regprocedure('public.normalize_song_title_for_match(text)')
  ) into arguments;
  if arguments is null then raise exception '曲名照合関数が見つかりません。旧SQLの適用状態を確認してください。'; end if;
  execute format($ddl$
    create or replace function public.normalize_song_title_for_match(%s)
    returns text language sql immutable set search_path = ''
    as $body$
      select replace(public.canonicalize_song_title_spacing($1), chr(12316), chr(65374));
    $body$;
  $ddl$,arguments);
end;
$migration$;
create index songs_version_part_normalized_title_idx
  on public.songs(version_id,part,public.normalize_song_title_for_match(title));

do $$
begin
  if public.normalize_song_title_for_match('Real 〜Lサイズの夢〜') <> public.normalize_song_title_for_match('Real ～Lサイズの夢～')
     or public.normalize_song_title_for_match('FIREBALL') = public.normalize_song_title_for_match('Fireball')
     or public.normalize_song_title_for_match('〜') = public.normalize_song_title_for_match('~')
     or public.normalize_song_title_for_match('CaptivAte〜裁き〜 (CLASSIC)') = public.normalize_song_title_for_match('CaptivAte～裁き～')
  then raise exception '正規化の検証に失敗しました'; end if;
end;
$$;

-- 曲マスターの画像あり/なし・画像表示でも2文字を同一視する。
create or replace function public.admin_list_song_master_jackets(
  p_search text default '',
  p_limit integer default 100,
  p_offset integer default 0,
  p_version_id uuid default null,
  p_type_filter text default '',
  p_image_filter text default ''
)
returns table(
  title text,
  initial_group text,
  official_order numeric,
  is_hot boolean,
  levels jsonb,
  jacket_image_url text,
  jacket_storage_path text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with grouped as (
    select
      s.title,
      max(s.initial_group) as initial_group,
      min(s.official_order) as official_order,
      bool_or(s.is_hot) as is_hot,
      jsonb_object_agg(s.part, s.level order by s.part) as levels,
      max(j.image_url) as jacket_image_url,
      max(j.storage_path) as jacket_storage_path
    from public.songs s
    left join lateral (
      select j.image_url, j.storage_path
      from public.song_jackets j
      where public.normalize_song_title_for_match(j.title) = public.normalize_song_title_for_match(s.title)
      order by case when j.title = s.title then 0 else 1 end, j.updated_at desc
      limit 1
    ) j on true
    where (p_version_id is null or s.version_id = p_version_id)
      and (
        btrim(coalesce(p_search, '')) = ''
        or s.title ilike '%' || btrim(p_search) || '%'
        or coalesce(s.initial_group, '') ilike '%' || btrim(p_search) || '%'
      )
      and (
        upper(btrim(coalesce(p_type_filter, ''))) = ''
        or (upper(btrim(p_type_filter)) = 'HOT' and s.is_hot)
        or (upper(btrim(p_type_filter)) = 'OTHER' and not s.is_hot)
      )
      and (
        upper(btrim(coalesce(p_image_filter, ''))) = ''
        or (upper(btrim(p_image_filter)) = 'WITH' and (j.image_url is not null or j.storage_path is not null))
        or (upper(btrim(p_image_filter)) = 'WITHOUT' and j.image_url is null and j.storage_path is null)
      )
    group by s.title
  ), ranked as (
    select
      g.*,
      case
        when g.initial_group = '記号・数字' then 0
        when g.initial_group ~ '^[A-Z]$' then ascii(g.initial_group) - ascii('A') + 1
        when g.initial_group = 'あ行' then 27
        when g.initial_group = 'か行' then 28
        when g.initial_group = 'さ行' then 29
        when g.initial_group = 'た行' then 30
        when g.initial_group = 'な行' then 31
        when g.initial_group = 'は行' then 32
        when g.initial_group = 'ま行' then 33
        when g.initial_group = 'や行' then 34
        when g.initial_group = 'ら行' then 35
        when g.initial_group = 'わ行' then 36
        else 999
      end as initial_rank
    from grouped g
  )
  select
    r.title,
    r.initial_group,
    r.official_order,
    r.is_hot,
    r.levels,
    r.jacket_image_url,
    r.jacket_storage_path,
    count(*) over() as total_count
  from ranked r
  order by
    r.initial_rank,
    r.official_order nulls last,
    r.title
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


-- 既存の管理者向け関数権限は維持する。
revoke all on function public.admin_list_song_master_jackets(text,integer,integer,uuid,text,text) from public,anon;
grant execute on function public.admin_list_song_master_jackets(text,integer,integer,uuid,text,text) to authenticated,service_role;
commit;
