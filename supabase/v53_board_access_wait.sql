-- v4.31.1 掲示板の登録後24時間アクセス待機
-- 一般ユーザーは登録から24時間経過するまで掲示板を閲覧できない。
-- 管理者は待機時間の対象外。
begin;

create or replace function public.board_can_current_user_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and (
      public.is_admin()
      or exists(
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.created_at <= now() - interval '24 hours'
      )
    );
$$;

create or replace function public.board_current_user_access_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_created_at timestamptz;
  v_available_at timestamptz;
  v_remaining integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('can_access', false, 'remaining_seconds', 0, 'available_at', null);
  end if;

  if public.is_admin() then
    return jsonb_build_object('can_access', true, 'remaining_seconds', 0, 'available_at', now());
  end if;

  select p.created_at into v_created_at
  from public.profiles p
  where p.id = auth.uid();

  if v_created_at is null then
    return jsonb_build_object('can_access', false, 'remaining_seconds', 0, 'available_at', null);
  end if;

  v_available_at := v_created_at + interval '24 hours';
  v_remaining := greatest(0, ceil(extract(epoch from (v_available_at - now())))::integer);

  return jsonb_build_object(
    'can_access', v_remaining <= 0,
    'remaining_seconds', v_remaining,
    'available_at', v_available_at
  );
end;
$$;

-- スレッド一覧もDB側で24時間待機を強制する。
create or replace function public.admin_board_list_threads_v2()
returns table(
  id uuid,
  author_id uuid,
  username text,
  title text,
  body_excerpt text,
  created_at timestamptz,
  activity_at timestamptz,
  reply_count bigint,
  image_count bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    t.id,
    t.author_id,
    p.username,
    t.title,
    left(t.body, 180),
    t.created_at,
    greatest(
      t.created_at,
      coalesce((
        select max(bp.created_at)
        from public.board_posts bp
        where bp.thread_id = t.id and bp.deleted_at is null
      ), t.created_at)
    ) as activity_at,
    (select count(*) from public.board_posts bp where bp.thread_id = t.id and bp.deleted_at is null),
    (select count(*) from public.board_images bi where bi.thread_id = t.id)
  from public.board_threads t
  join public.profiles p on p.id = t.author_id
  where public.board_can_current_user_access()
    and t.deleted_at is null
  order by activity_at desc, t.created_at desc;
$$;

-- スレッド詳細もDB側で24時間待機を強制する。
create or replace function public.admin_board_get_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.board_can_current_user_access() then
    raise exception '掲示板は登録から24時間経過後に利用できます。';
  end if;

  select jsonb_build_object(
    'thread', jsonb_build_object(
      'id', t.id,
      'author_id', t.author_id,
      'username', p.username,
      'title', t.title,
      'body', t.body,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'deleted_at', t.deleted_at,
      'images', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'storage_path', i.storage_path, 'sort_order', i.sort_order,
          'width', i.width, 'height', i.height, 'size_bytes', i.size_bytes
        ) order by i.sort_order)
        from public.board_images i
        where i.thread_id = t.id and i.post_id is null
      ), '[]'::jsonb)
    ),
    'replies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bp.id,
        'thread_id', bp.thread_id,
        'author_id', bp.author_id,
        'username', pp.username,
        'body', bp.body,
        'created_at', bp.created_at,
        'updated_at', bp.updated_at,
        'deleted_at', bp.deleted_at,
        'images', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'storage_path', i.storage_path, 'sort_order', i.sort_order,
            'width', i.width, 'height', i.height, 'size_bytes', i.size_bytes
          ) order by i.sort_order)
          from public.board_images i
          where i.post_id = bp.id
        ), '[]'::jsonb)
      ) order by bp.created_at)
      from public.board_posts bp
      join public.profiles pp on pp.id = bp.author_id
      where bp.thread_id = t.id and bp.deleted_at is null
    ), '[]'::jsonb)
  ) into v_result
  from public.board_threads t
  join public.profiles p on p.id = t.author_id
  where t.id = p_thread_id and t.deleted_at is null;

  return v_result;
end;
$$;

-- 24時間未満はStorage上の掲示板画像も閲覧不可。
drop policy if exists board_images_storage_select_authenticated on storage.objects;
create policy board_images_storage_select_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'board-images' and public.board_can_current_user_access());

revoke all on function public.board_can_current_user_access() from public;
revoke all on function public.board_current_user_access_status() from public;
grant execute on function public.board_can_current_user_access() to authenticated;
grant execute on function public.board_current_user_access_status() to authenticated;

commit;
