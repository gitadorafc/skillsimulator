-- v4.29.1 掲示板: 画像使用量 / 通報対象ユーザー / 投稿者本人のみ編集
begin;

create or replace function public.admin_board_storage_usage()
returns table(
  used_bytes bigint,
  image_count bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(sum(bi.size_bytes), 0)::bigint as used_bytes,
    count(*)::bigint as image_count
  from public.board_images bi
  where public.is_admin();
$$;

drop function if exists public.admin_board_list_reports();

create or replace function public.admin_board_list_reports()
returns table(
  id uuid,
  reporter_id uuid,
  reporter_username text,
  reason text,
  details text,
  created_at timestamptz,
  target_text text,
  target_author_id uuid,
  target_username text
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
    target_user.username as target_username
  from public.board_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  left join public.board_threads t on t.id = r.thread_id
  left join public.board_posts bp on bp.id = r.post_id
  left join public.profiles target_user on target_user.id = coalesce(t.author_id, bp.author_id)
  where public.is_admin() and r.resolved_at is null
  order by r.created_at desc;
$$;

create or replace function public.admin_board_update_thread(p_thread_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'この機能は管理者専用です。';
  end if;
  update public.board_threads
  set title=btrim(p_title), body=btrim(p_body), updated_at=now()
  where id=p_thread_id and deleted_at is null and author_id=auth.uid();
  if not found then
    raise exception '編集できるのは投稿者本人だけです。';
  end if;
end;
$$;

create or replace function public.admin_board_update_reply(p_post_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'この機能は管理者専用です。';
  end if;
  update public.board_posts
  set body=btrim(p_body), updated_at=now()
  where id=p_post_id and deleted_at is null and author_id=auth.uid();
  if not found then
    raise exception '編集できるのは投稿者本人だけです。';
  end if;
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
  if auth.uid() is null or not public.is_admin() then
    raise exception 'この機能は管理者専用です。';
  end if;
  if (p_thread_id is null) = (p_post_id is null) then
    raise exception '通報対象を1件指定してください。';
  end if;
  if v_reason not in ('荒らし','個人情報','不適切な画像','誹謗中傷','公序良俗','その他') then
    raise exception '通報理由が不正です。';
  end if;
  if v_details is not null and char_length(v_details) > 500 then
    raise exception '通報の詳細は500文字以内です。';
  end if;

  if p_thread_id is not null then
    select author_id into v_target_author
    from public.board_threads
    where id=p_thread_id and deleted_at is null;
  else
    select author_id into v_target_author
    from public.board_posts
    where id=p_post_id and deleted_at is null;
  end if;

  if v_target_author is null then
    raise exception '通報対象がありません。';
  end if;
  if v_target_author = auth.uid() then
    raise exception '自分の投稿は通報できません。';
  end if;

  insert into public.board_reports(reporter_id, thread_id, post_id, reason, details)
  values(auth.uid(), p_thread_id, p_post_id, v_reason, v_details)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_board_storage_usage() from public;
revoke all on function public.admin_board_list_reports() from public;
revoke all on function public.admin_board_update_thread(uuid,text,text) from public;
revoke all on function public.admin_board_update_reply(uuid,text) from public;
revoke all on function public.admin_board_create_report(uuid,uuid,text,text) from public;

grant execute on function public.admin_board_storage_usage() to authenticated;
grant execute on function public.admin_board_list_reports() to authenticated;
grant execute on function public.admin_board_update_thread(uuid,text,text) to authenticated;
grant execute on function public.admin_board_update_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_create_report(uuid,uuid,text,text) to authenticated;

commit;
