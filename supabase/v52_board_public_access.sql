-- v4.31.0 掲示板一般公開
-- 登録ユーザーは閲覧可能。登録から24時間経過かつ投稿禁止でないユーザーは投稿可能。
begin;

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
  where auth.uid() is not null and t.deleted_at is null
  order by activity_at desc, t.created_at desc;
$$;

create or replace function public.admin_board_get_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;

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

create or replace function public.admin_board_create_thread(p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title,''));
  v_body text := btrim(coalesce(p_body,''));
begin
  if not public.board_can_current_user_post() then
    raise exception '掲示板への投稿は登録から24時間経過後に利用できます。投稿禁止中の場合は利用できません。';
  end if;
  if char_length(v_title) not between 1 and 30 then raise exception 'タイトルは30文字以内です。'; end if;
  if char_length(v_body) not between 1 and 1000 then raise exception '本文は1000文字以内です。'; end if;
  insert into public.board_threads(author_id,title,body)
  values(auth.uid(), v_title, v_body) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_board_update_thread(p_thread_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text := btrim(coalesce(p_title,''));
  v_body text := btrim(coalesce(p_body,''));
begin
  if not public.board_can_current_user_post() then raise exception '現在、掲示板への投稿・編集は利用できません。'; end if;
  if char_length(v_title) not between 1 and 30 then raise exception 'タイトルは30文字以内です。'; end if;
  if char_length(v_body) not between 1 and 1000 then raise exception '本文は1000文字以内です。'; end if;
  update public.board_threads set title=v_title, body=v_body, updated_at=now()
  where id=p_thread_id and deleted_at is null and author_id=auth.uid();
  if not found then raise exception '編集できるのは投稿者本人だけです。'; end if;
end;
$$;

create or replace function public.admin_board_create_reply(p_thread_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_body text := btrim(coalesce(p_body,''));
begin
  if not public.board_can_current_user_post() then
    raise exception '掲示板への投稿は登録から24時間経過後に利用できます。投稿禁止中の場合は利用できません。';
  end if;
  if char_length(v_body) not between 1 and 1000 then raise exception '本文は1000文字以内です。'; end if;
  if not exists(select 1 from public.board_threads where id=p_thread_id and deleted_at is null) then raise exception '対象スレッドがありません。'; end if;
  insert into public.board_posts(thread_id,author_id,body)
  values(p_thread_id,auth.uid(),v_body) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_board_update_reply(p_post_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_body text := btrim(coalesce(p_body,''));
begin
  if not public.board_can_current_user_post() then raise exception '現在、掲示板への投稿・編集は利用できません。'; end if;
  if char_length(v_body) not between 1 and 1000 then raise exception '本文は1000文字以内です。'; end if;
  update public.board_posts set body=v_body, updated_at=now()
  where id=p_post_id and deleted_at is null and author_id=auth.uid();
  if not found then raise exception '編集できるのは投稿者本人だけです。'; end if;
end;
$$;

create or replace function public.admin_board_soft_delete_thread(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  update public.board_threads
  set deleted_at=now(), deleted_by=auth.uid(), deletion_reason=case when public.is_admin() then '管理者削除' else '投稿者削除' end
  where id=p_thread_id and deleted_at is null and (author_id=auth.uid() or public.is_admin());
  if not found then raise exception '削除できません。'; end if;
end;
$$;

create or replace function public.admin_board_soft_delete_reply(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  update public.board_posts
  set deleted_at=now(), deleted_by=auth.uid(), deletion_reason=case when public.is_admin() then '管理者削除' else '投稿者削除' end
  where id=p_post_id and deleted_at is null and (author_id=auth.uid() or public.is_admin());
  if not found then raise exception '削除できません。'; end if;
end;
$$;

create or replace function public.admin_board_add_image(
  p_thread_id uuid,
  p_post_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_width integer,
  p_height integer,
  p_sort_order smallint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_count integer;
begin
  if not public.board_can_current_user_post() then raise exception '現在、掲示板への画像投稿は利用できません。'; end if;
  if split_part(p_storage_path,'/',1) <> auth.uid()::text then raise exception '画像パスが不正です。'; end if;
  if p_post_id is null then
    if not exists(select 1 from public.board_threads where id=p_thread_id and author_id=auth.uid() and deleted_at is null) then
      raise exception '対象スレッドがありません。';
    end if;
  else
    if not exists(select 1 from public.board_posts where id=p_post_id and thread_id=p_thread_id and author_id=auth.uid() and deleted_at is null) then
      raise exception '対象投稿がありません。';
    end if;
  end if;
  select count(*) into v_count from public.board_images
  where thread_id=p_thread_id and ((p_post_id is null and post_id is null) or post_id=p_post_id);
  if v_count >= 1 then raise exception '画像は1投稿1枚までです。'; end if;
  insert into public.board_images(thread_id,post_id,owner_id,storage_path,mime_type,size_bytes,width,height,sort_order)
  values(p_thread_id,p_post_id,auth.uid(),p_storage_path,p_mime_type,p_size_bytes,p_width,p_height,0)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_board_remove_image_record(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  delete from public.board_images
  where id=p_image_id and (owner_id=auth.uid() or public.is_admin());
  if not found then raise exception '画像を削除できません。'; end if;
end;
$$;

create or replace function public.admin_board_create_report(
  p_thread_id uuid default null,
  p_post_id uuid default null,
  p_reason text default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason,''));
  v_details text := nullif(btrim(coalesce(p_details,'')), '');
  v_target_author uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  if (p_thread_id is null) = (p_post_id is null) then raise exception '通報対象を1件指定してください。'; end if;
  if v_reason not in ('荒らし','個人情報','不適切な画像','誹謗中傷','公序良俗','その他') then raise exception '通報理由が不正です。'; end if;
  if v_details is not null and char_length(v_details) > 500 then raise exception '通報の詳細は500文字以内です。'; end if;
  if p_thread_id is not null then
    select author_id into v_target_author from public.board_threads where id=p_thread_id and deleted_at is null;
  else
    select author_id into v_target_author from public.board_posts where id=p_post_id and deleted_at is null;
  end if;
  if v_target_author is null then raise exception '通報対象がありません。'; end if;
  if v_target_author = auth.uid() then raise exception '自分の投稿は通報できません。'; end if;
  insert into public.board_reports(reporter_id, thread_id, post_id, reason, details)
  values(auth.uid(), p_thread_id, p_post_id, v_reason, v_details)
  returning id into v_id;
  return v_id;
end;
$$;

-- Storage: ログインユーザーは画像を閲覧可能。投稿者は自分のパスへ保存/削除、管理者は削除可能。
drop policy if exists board_images_storage_select_admin on storage.objects;
drop policy if exists board_images_storage_insert_admin on storage.objects;
drop policy if exists board_images_storage_delete_admin on storage.objects;
drop policy if exists board_images_storage_select_authenticated on storage.objects;
drop policy if exists board_images_storage_insert_owner on storage.objects;
drop policy if exists board_images_storage_delete_owner_or_admin on storage.objects;

create policy board_images_storage_select_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'board-images');

create policy board_images_storage_insert_owner on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'board-images'
    and split_part(name,'/',1) = auth.uid()::text
    and public.board_can_current_user_post()
  );

create policy board_images_storage_delete_owner_or_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'board-images'
    and (split_part(name,'/',1) = auth.uid()::text or public.is_admin())
  );

revoke all on function public.admin_board_list_threads_v2() from public;
revoke all on function public.admin_board_get_thread(uuid) from public;
revoke all on function public.admin_board_create_thread(text,text) from public;
revoke all on function public.admin_board_update_thread(uuid,text,text) from public;
revoke all on function public.admin_board_create_reply(uuid,text) from public;
revoke all on function public.admin_board_update_reply(uuid,text) from public;
revoke all on function public.admin_board_soft_delete_thread(uuid) from public;
revoke all on function public.admin_board_soft_delete_reply(uuid) from public;
revoke all on function public.admin_board_add_image(uuid,uuid,text,text,integer,integer,integer,smallint) from public;
revoke all on function public.admin_board_remove_image_record(uuid) from public;
revoke all on function public.admin_board_create_report(uuid,uuid,text,text) from public;

grant execute on function public.admin_board_list_threads_v2() to authenticated;
grant execute on function public.admin_board_get_thread(uuid) to authenticated;
grant execute on function public.admin_board_create_thread(text,text) to authenticated;
grant execute on function public.admin_board_update_thread(uuid,text,text) to authenticated;
grant execute on function public.admin_board_create_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_update_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_soft_delete_thread(uuid) to authenticated;
grant execute on function public.admin_board_soft_delete_reply(uuid) to authenticated;
grant execute on function public.admin_board_add_image(uuid,uuid,text,text,integer,integer,integer,smallint) to authenticated;
grant execute on function public.admin_board_remove_image_record(uuid) to authenticated;
grant execute on function public.admin_board_create_report(uuid,uuid,text,text) to authenticated;

commit;
