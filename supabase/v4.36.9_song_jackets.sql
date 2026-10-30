-- v4.36.9: 曲単位ジャケット。先に適用し、続いてCSVをステージングにインポートする。
begin;
create table if not exists public.song_jackets (
 title text primary key,
 image_url text,
 storage_path text,
 updated_at timestamptz not null default now(),
 constraint jacket_https check(image_url is null or image_url ~ '^https://'),
 constraint jacket_has_source check(image_url is not null or storage_path is not null)
);
alter table public.song_jackets enable row level security;
drop policy if exists jackets_read on public.song_jackets;
create policy jackets_read on public.song_jackets for select to authenticated using (true);
drop policy if exists jackets_admin_insert on public.song_jackets;
create policy jackets_admin_insert on public.song_jackets for insert to authenticated with check(public.is_admin());
drop policy if exists jackets_admin_update on public.song_jackets;
create policy jackets_admin_update on public.song_jackets for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists jackets_admin_delete on public.song_jackets;
create policy jackets_admin_delete on public.song_jackets for delete to authenticated using(public.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('song-jackets','song-jackets',true,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=1048576,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists song_jackets_storage_admin_insert on storage.objects;
create policy song_jackets_storage_admin_insert on storage.objects for insert to authenticated
 with check(bucket_id='song-jackets' and public.is_admin());
drop policy if exists song_jackets_storage_admin_delete on storage.objects;
create policy song_jackets_storage_admin_delete on storage.objects for delete to authenticated
 using(bucket_id='song-jackets' and public.is_admin());
create or replace function public.admin_save_song_jacket(p_title text,p_image_url text default null,p_storage_path text default null,p_clear boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_title text := btrim(coalesce(p_title,''));
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
revoke all on function public.admin_save_song_jacket(text,text,text,boolean) from public,anon;
grant execute on function public.admin_save_song_jacket(text,text,text,boolean) to authenticated,service_role;
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

revoke all on function public.admin_list_song_master_jackets(text,integer,integer,uuid,text,text) from public,anon;
grant execute on function public.admin_list_song_master_jackets(text,integer,integer,uuid,text,text) to authenticated,service_role;
commit;
