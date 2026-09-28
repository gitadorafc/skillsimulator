-- v4.30.0 掲示板: 投稿文字数/画像数制限・通報対象投稿表示用
begin;

-- 通報一覧 v2: 対象スレッドID/投稿IDを返し、該当投稿へ移動できるようにする。
create or replace function public.admin_board_list_reports_v2()
returns table(
  id uuid,
  reporter_id uuid,
  reporter_username text,
  reason text,
  details text,
  created_at timestamptz,
  target_text text,
  target_author_id uuid,
  target_username text,
  target_thread_id uuid,
  target_post_id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    r.reporter_id,
    reporter.username,
    r.reason,
    r.details,
    r.created_at,
    case
      when r.thread_id is not null then coalesce(t.title, '')
      else left(coalesce(bp.body, ''), 120)
    end as target_text,
    coalesce(t.author_id, bp.author_id) as target_author_id,
    target_user.username as target_username,
    coalesce(r.thread_id, bp.thread_id) as target_thread_id,
    r.post_id as target_post_id
  from public.board_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  left join public.board_threads t on t.id = r.thread_id
  left join public.board_posts bp on bp.id = r.post_id
  left join public.profiles target_user on target_user.id = coalesce(t.author_id, bp.author_id)
  where public.is_admin() and r.resolved_at is null
  order by r.created_at desc;
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  if char_length(v_body) not between 1 and 1000 then raise exception '本文は1000文字以内です。'; end if;
  update public.board_posts set body=v_body, updated_at=now()
  where id=p_post_id and deleted_at is null and author_id=auth.uid();
  if not found then raise exception '編集できるのは投稿者本人だけです。'; end if;
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  if p_post_id is not null and not exists(
    select 1 from public.board_posts where id=p_post_id and thread_id=p_thread_id and deleted_at is null
  ) then
    raise exception '対象の投稿がありません。';
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

revoke all on function public.admin_board_list_reports_v2() from public;
revoke all on function public.admin_board_create_thread(text,text) from public;
revoke all on function public.admin_board_update_thread(uuid,text,text) from public;
revoke all on function public.admin_board_create_reply(uuid,text) from public;
revoke all on function public.admin_board_update_reply(uuid,text) from public;
revoke all on function public.admin_board_add_image(uuid,uuid,text,text,integer,integer,integer,smallint) from public;

grant execute on function public.admin_board_list_reports_v2() to authenticated;
grant execute on function public.admin_board_create_thread(text,text) to authenticated;
grant execute on function public.admin_board_update_thread(uuid,text,text) to authenticated;
grant execute on function public.admin_board_create_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_update_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_add_image(uuid,uuid,text,text,integer,integer,integer,smallint) to authenticated;

commit;
