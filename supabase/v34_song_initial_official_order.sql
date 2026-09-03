-- v34: 読み仮名に依存せず、公式カテゴリと公式表示順を曲単位で管理する。

begin;

alter table public.songs
  add column if not exists initial_group text,
  add column if not exists official_order numeric(14,4);

alter table public.songs
  drop constraint if exists songs_initial_group_check;

alter table public.songs
  add constraint songs_initial_group_check check (
    initial_group is null or initial_group in (
      '記号・数字',
      'A','B','C','D','E','F','G','H','I','J','K','L','M',
      'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
      'あ行','か行','さ行','た行','な行',
      'は行','ま行','や行','ら行','わ行'
    )
  );

create index if not exists songs_version_initial_order_idx
  on public.songs(version_id, initial_group, official_order, title);

-- CSV・横一括編集用。譜面保存と頭文字・並び順更新を同一トランザクションにする。
create or replace function public.admin_save_song_master_rows_atomic(
  p_rows jsonb,
  p_version_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved integer;
  v_row jsonb;
  v_title text;
  v_initial text;
  v_order numeric;
begin
  if not public.is_admin() then
    raise exception '管理者権限がありません。';
  end if;

  select public.admin_bulk_save_song_master(p_rows, p_version_id)
    into v_saved;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_title := btrim(coalesce(v_row ->> 'title', ''));
    if v_title = '' then
      continue;
    end if;

    if v_row ? 'initial_group' and nullif(btrim(v_row ->> 'initial_group'), '') is not null then
      v_initial := btrim(v_row ->> 'initial_group');
      if v_initial not in (
        '記号・数字',
        'A','B','C','D','E','F','G','H','I','J','K','L','M',
        'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
        'あ行','か行','さ行','た行','な行',
        'は行','ま行','や行','ら行','わ行'
      ) then
        raise exception '頭文字が不正です: %', v_initial;
      end if;

      update public.songs
      set initial_group = v_initial
      where version_id = p_version_id and title = v_title;
    end if;

    if v_row ? 'official_order' and nullif(replace(btrim(v_row ->> 'official_order'), ',', ''), '') is not null then
      begin
        v_order := replace(btrim(v_row ->> 'official_order'), ',', '')::numeric;
      exception when invalid_text_representation then
        raise exception '並び順が不正です: %', v_row ->> 'official_order';
      end;

      if v_order < 0 then
        raise exception '並び順は0以上で入力してください。';
      end if;

      update public.songs
      set official_order = v_order
      where version_id = p_version_id and title = v_title;
    end if;
  end loop;

  return coalesce(v_saved, 0);
end;
$$;

revoke all on function public.admin_save_song_master_rows_atomic(jsonb, uuid)
  from public, anon;
grant execute on function public.admin_save_song_master_rows_atomic(jsonb, uuid)
  to authenticated, service_role;

create or replace function public.admin_list_song_master_ordered(
  p_search text default '',
  p_limit integer default 100,
  p_offset integer default 0,
  p_version_id uuid default null,
  p_type_filter text default ''
)
returns table(
  title text,
  initial_group text,
  official_order numeric,
  is_hot boolean,
  levels jsonb,
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
      jsonb_object_agg(s.part, s.level order by s.part) as levels
    from public.songs s
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
    count(*) over() as total_count
  from ranked r
  order by
    r.initial_rank,
    r.official_order nulls last,
    r.title
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.admin_list_song_master_ordered(text, integer, integer, uuid, text)
  from public, anon;
grant execute on function public.admin_list_song_master_ordered(text, integer, integer, uuid, text)
  to authenticated, service_role;

create or replace function public.list_song_picker_ordered(
  p_version_id uuid,
  p_instrument text default 'GF',
  p_limit integer default 500,
  p_offset integer default 0
)
returns table(
  title text,
  initial_group text,
  official_order numeric,
  is_hot boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.title,
    max(s.initial_group) as initial_group,
    min(s.official_order) as official_order,
    bool_or(s.is_hot) as is_hot
  from public.songs s
  where s.version_id = p_version_id
    and (
      (upper(coalesce(p_instrument, 'GF')) = 'DM' and s.part like '%-D')
      or
      (upper(coalesce(p_instrument, 'GF')) <> 'DM' and (s.part like '%-G' or s.part like '%-B'))
    )
  group by s.title
  order by
    case
      when max(s.initial_group) = '記号・数字' then 0
      when max(s.initial_group) ~ '^[A-Z]$' then ascii(max(s.initial_group)) - ascii('A') + 1
      when max(s.initial_group) = 'あ行' then 27
      when max(s.initial_group) = 'か行' then 28
      when max(s.initial_group) = 'さ行' then 29
      when max(s.initial_group) = 'た行' then 30
      when max(s.initial_group) = 'な行' then 31
      when max(s.initial_group) = 'は行' then 32
      when max(s.initial_group) = 'ま行' then 33
      when max(s.initial_group) = 'や行' then 34
      when max(s.initial_group) = 'ら行' then 35
      when max(s.initial_group) = 'わ行' then 36
      else 999
    end,
    min(s.official_order) nulls last,
    s.title
  limit least(greatest(coalesce(p_limit, 500), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_song_picker_ordered(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.list_song_picker_ordered(uuid, text, integer, integer)
  to authenticated;

commit;
