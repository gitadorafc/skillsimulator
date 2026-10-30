-- v4.36.12 波ダッシュ保存統一・曲マスター高速復旧
-- v4.36.11を適用済、v4.36.11 timeout hotfixは未適用のDB向け
-- U+301C → U+FF5E、ASCII ~ と大文字小文字は維持
-- 全データのバックアップ取得を推奨。衝突が見つかればトランザクション全体を中止。
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
lock table public.songs, public.song_requests, public.song_jackets in share row exclusive mode;

-- U+FF5Eの正規化をスペース正規化と共通化し、書き込み時に保存名を固定する。
-- 正規化関数に依存する式索引は再作成する。
drop index if exists public.songs_version_part_normalized_title_idx;
create or replace function public.canonicalize_song_title_spacing(p_title text)
returns text language sql immutable set search_path = '' as $$
  select replace(
    btrim(regexp_replace(
      translate(coalesce($1, ''),
        chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160) || chr(12288),
        repeat(' ', 7)),
      ' +', ' ', 'g')),
    chr(12316), chr(65374));
$$;

-- 保存済みスコアはsong_idで紐づくので曲IDは一切変更しない。
-- ただし曲名列の一意制約に衝突する場合は更新前に全体を中止する。
do $$
declare issues text;
begin
  select string_agg(format('%s / %s / %s: %s', version_id, part, fixed_title, ids), E'\n') into issues
  from (
    select version_id,part, public.canonicalize_song_title_spacing(title) fixed_title,
           string_agg(id::text,', ' order by id) ids
    from public.songs
    group by version_id,part,public.canonicalize_song_title_spacing(title)
    having count(*) > 1 limit 20
  ) c;
  if issues is not null then
    raise exception '曲マスターの正規化衝突のため中止' using detail=issues;
  end if;
  select string_agg(format('%s (件数%s)',fixed_title,n),E'\n') into issues
  from (select public.canonicalize_song_title_spacing(title) fixed_title, count(*) n
        from public.song_jackets group by 1 having count(*) > 1 limit 20) c;
  if issues is not null then
    raise exception 'ジャケットの正規化衝突のため中止（どちらを残すか確認が必要）' using detail=issues;
  end if;
  select string_agg(format('%s / %s / %s / %s',requester_id,version_id,part,fixed_title),E'\n') into issues
  from (select requester_id,version_id,part,public.canonicalize_song_title_spacing(title) fixed_title
        from public.song_requests where status='pending' and request_type='new_song'
        group by requester_id,version_id,part,public.canonicalize_song_title_spacing(title)
        having count(*)>1 limit 20) c;
  if issues is not null then
    raise exception '未処理登録依頼の正規化衝突のため中止' using detail=issues;
  end if;
end $$;

update public.songs set title=public.canonicalize_song_title_spacing(title)
 where title is distinct from public.canonicalize_song_title_spacing(title);
update public.song_requests set title=public.canonicalize_song_title_spacing(title)
 where title is distinct from public.canonicalize_song_title_spacing(title);
update public.song_jackets set title=public.canonicalize_song_title_spacing(title)
 where title is distinct from public.canonicalize_song_title_spacing(title);

-- 全クライアント（過去版を含む）で、直接INSERT/UPDATE時も正規化してから保存。
create or replace function public.enforce_song_title_spacing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.title is not null then new.title := public.canonicalize_song_title_spacing(new.title); end if;
  return new;
end; $$;
drop trigger if exists songs_title_spacing on public.songs;
create trigger songs_title_spacing before insert or update of title on public.songs
for each row execute function public.enforce_song_title_spacing();
drop trigger if exists song_requests_title_spacing on public.song_requests;
create trigger song_requests_title_spacing before insert or update of title on public.song_requests
for each row execute function public.enforce_song_title_spacing();
drop trigger if exists jackets_title_canonical on public.song_jackets;
create trigger jackets_title_canonical before insert or update of title on public.song_jackets
for each row execute function public.enforce_song_title_spacing();

-- 正規化関数は通常の完全一致と同等にする。既存の引数名を保護。
do $migration$
declare args text;
begin
  select pg_catalog.pg_get_function_arguments(pg_catalog.to_regprocedure('public.normalize_song_title_for_match(text)')) into args;
  execute format($ddl$
    create or replace function public.normalize_song_title_for_match(%s)
    returns text language sql immutable set search_path = '' as $fn$
      select public.canonicalize_song_title_spacing($1);
    $fn$;
  $ddl$,coalesce(args,'p_title text'));
end;$migration$;
create index songs_version_part_normalized_title_idx
on public.songs(version_id,part,public.normalize_song_title_for_match(title));

-- 通常のタイトル一致インデックスで高速検索。表示毎のLATERAL正規化検索を廃止。
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
    left join public.song_jackets j on j.title = s.title
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


-- ジャケットの管理RPCも保存時に正規化（セキュリティ条件は従来を維持）。
create or replace function public.admin_save_song_jacket(p_title text,p_image_url text default null,p_storage_path text default null,p_clear boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_title text := public.canonicalize_song_title_spacing(p_title);
begin
 if not public.is_admin() then raise exception '管理者権限がありません'; end if;
 if v_title = '' or not exists(select 1 from public.songs where title=v_title) then raise exception '曲マスターに存在しない曲です: %',v_title; end if;
 if p_clear then delete from public.song_jackets where title=v_title; return; end if;
 if p_image_url is not null and p_image_url !~ '^https://' then raise exception '画像URLはhttps://にしてください';end if;
 if p_image_url is null and p_storage_path is null then raise exception '画像URLか画像ファイルを指定してください'; end if;
 insert into public.song_jackets(title,image_url,storage_path) values(v_title,p_image_url,p_storage_path)
 on conflict(title) do update set image_url=case when excluded.storage_path is not null then null else coalesce(excluded.image_url,public.song_jackets.image_url) end,
 storage_path=case when excluded.image_url is not null then null else coalesce(excluded.storage_path,public.song_jackets.storage_path) end,updated_at=now();
end;$$;

-- 代表例の保存形を検査。
do $$ begin
 if public.canonicalize_song_title_spacing('Real 〜Lサイズの夢〜') <> 'Real ～Lサイズの夢～'
  or public.canonicalize_song_title_spacing('FIREBALL') = public.canonicalize_song_title_spacing('Fireball')
  or public.canonicalize_song_title_spacing('～') = public.canonicalize_song_title_spacing('~')
 then raise exception '正規化チェック失敗'; end if;
end $$;
commit;

-- 変更件数と代表的な曲名の最終状態（読み取りのみ）。
select 'songs' as table_name,count(*) filter(where title like '%'||chr(12316)||'%') as remaining_u301c from public.songs
union all select 'song_requests',count(*) filter(where title like '%'||chr(12316)||'%') from public.song_requests
union all select 'song_jackets',count(*) filter(where title like '%'||chr(12316)||'%') from public.song_jackets;
