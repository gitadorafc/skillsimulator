-- v4.28.0 管理者向け掲示板初期実装
-- 一般ユーザーUIは未公開。RLS/RPCは現時点では管理者のみ許可する。
begin;

create table if not exists public.board_user_moderation (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  posting_blocked boolean not null default false,
  blocked_reason text,
  blocked_at timestamptz,
  blocked_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  deletion_reason text
);

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.board_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  deletion_reason text
);

create table if not exists public.board_images (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.board_threads(id) on delete cascade,
  post_id uuid references public.board_posts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  sort_order smallint not null default 0 check (sort_order between 0 and 3),
  created_at timestamptz not null default now(),
  constraint board_images_target_check check (
    (post_id is null) or (post_id is not null)
  )
);

create table if not exists public.board_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.board_threads(id) on delete cascade,
  post_id uuid references public.board_posts(id) on delete cascade,
  reason text not null check (reason in ('荒らし','個人情報','不適切な画像','誹謗中傷','公序良俗','その他')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_note text,
  constraint board_reports_target_check check (
    (thread_id is not null and post_id is null) or
    (thread_id is null and post_id is not null)
  )
);

create index if not exists board_threads_created_idx on public.board_threads(created_at desc);
create index if not exists board_posts_thread_created_idx on public.board_posts(thread_id, created_at);
create index if not exists board_images_thread_idx on public.board_images(thread_id, post_id, sort_order);
create index if not exists board_reports_unresolved_idx on public.board_reports(resolved_at, created_at desc);

alter table public.board_user_moderation enable row level security;
alter table public.board_threads enable row level security;
alter table public.board_posts enable row level security;
alter table public.board_images enable row level security;
alter table public.board_reports enable row level security;

-- 初期段階は管理者だけが掲示板データを扱える。
drop policy if exists board_user_moderation_admin_all on public.board_user_moderation;
create policy board_user_moderation_admin_all on public.board_user_moderation
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists board_threads_admin_all on public.board_threads;
create policy board_threads_admin_all on public.board_threads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists board_posts_admin_all on public.board_posts;
create policy board_posts_admin_all on public.board_posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists board_images_admin_all on public.board_images;
create policy board_images_admin_all on public.board_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists board_reports_admin_all on public.board_reports;
create policy board_reports_admin_all on public.board_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.board_user_moderation to authenticated;
grant select, insert, update on public.board_threads to authenticated;
grant select, insert, update on public.board_posts to authenticated;
grant select, insert, delete on public.board_images to authenticated;
grant select, update on public.board_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-images',
  'board-images',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists board_images_storage_select_admin on storage.objects;
create policy board_images_storage_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'board-images' and public.is_admin());

drop policy if exists board_images_storage_insert_admin on storage.objects;
create policy board_images_storage_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'board-images' and public.is_admin());

drop policy if exists board_images_storage_delete_admin on storage.objects;
create policy board_images_storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'board-images' and public.is_admin());

create or replace function public.admin_board_list_threads()
returns table(
  id uuid,
  author_id uuid,
  username text,
  title text,
  body_excerpt text,
  created_at timestamptz,
  updated_at timestamptz,
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
    t.updated_at,
    (select count(*) from public.board_posts bp where bp.thread_id = t.id and bp.deleted_at is null),
    (select count(*) from public.board_images bi where bi.thread_id = t.id)
  from public.board_threads t
  join public.profiles p on p.id = t.author_id
  where public.is_admin() and t.deleted_at is null
  order by greatest(t.updated_at, coalesce((select max(bp.updated_at) from public.board_posts bp where bp.thread_id=t.id), t.updated_at)) desc;
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
  if auth.uid() is null or not public.is_admin() then
    raise exception 'この機能は管理者専用です。';
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

create or replace function public.admin_board_create_thread(p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  insert into public.board_threads(author_id,title,body)
  values(auth.uid(), btrim(p_title), btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_board_update_thread(p_thread_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  update public.board_threads set title=btrim(p_title), body=btrim(p_body), updated_at=now()
  where id=p_thread_id and deleted_at is null;
  if not found then raise exception '対象スレッドがありません。'; end if;
end;
$$;

create or replace function public.admin_board_create_reply(p_thread_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  if not exists(select 1 from public.board_threads where id=p_thread_id and deleted_at is null) then raise exception '対象スレッドがありません。'; end if;
  insert into public.board_posts(thread_id,author_id,body)
  values(p_thread_id,auth.uid(),btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_board_update_reply(p_post_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  update public.board_posts set body=btrim(p_body), updated_at=now()
  where id=p_post_id and deleted_at is null;
  if not found then raise exception '対象の返信がありません。'; end if;
end;
$$;

create or replace function public.admin_board_soft_delete_thread(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  update public.board_threads set deleted_at=now(), deleted_by=auth.uid(), deletion_reason='管理者削除', updated_at=now()
  where id=p_thread_id and deleted_at is null;
end;
$$;

create or replace function public.admin_board_soft_delete_reply(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  update public.board_posts set deleted_at=now(), deleted_by=auth.uid(), deletion_reason='管理者削除', updated_at=now()
  where id=p_post_id and deleted_at is null;
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
declare v_id uuid; v_count integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  if p_post_id is not null and not exists(select 1 from public.board_posts where id=p_post_id and thread_id=p_thread_id and deleted_at is null) then
    raise exception '対象の返信がありません。';
  end if;
  select count(*) into v_count from public.board_images
  where thread_id=p_thread_id and ((p_post_id is null and post_id is null) or post_id=p_post_id);
  if v_count >= 4 then raise exception '画像は1投稿4枚までです。'; end if;
  insert into public.board_images(thread_id,post_id,owner_id,storage_path,mime_type,size_bytes,width,height,sort_order)
  values(p_thread_id,p_post_id,auth.uid(),p_storage_path,p_mime_type,p_size_bytes,p_width,p_height,p_sort_order)
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  delete from public.board_images where id=p_image_id;
end;
$$;

create or replace function public.admin_board_list_user_states()
returns table(user_id uuid, posting_blocked boolean, blocked_reason text, blocked_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         coalesce(m.posting_blocked,false),
         m.blocked_reason,
         m.blocked_at
  from public.profiles p
  left join public.board_user_moderation m on m.user_id=p.id
  where public.is_admin();
$$;

create or replace function public.admin_board_get_user_state(p_user_id uuid)
returns table(user_id uuid, posting_blocked boolean, blocked_reason text, blocked_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         coalesce(m.posting_blocked,false),
         m.blocked_reason,
         m.blocked_at
  from public.profiles p
  left join public.board_user_moderation m on m.user_id=p.id
  where public.is_admin() and p.id=p_user_id;
$$;

create or replace function public.admin_board_set_user_blocked(p_user_id uuid, p_blocked boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  if p_blocked and exists(select 1 from public.admin_users where user_id=p_user_id) then
    raise exception '管理者アカウントは投稿禁止にできません。';
  end if;
  insert into public.board_user_moderation(user_id,posting_blocked,blocked_reason,blocked_at,blocked_by,updated_at)
  values(p_user_id,p_blocked,case when p_blocked then nullif(btrim(p_reason),'') else null end,
         case when p_blocked then now() else null end,
         case when p_blocked then auth.uid() else null end,now())
  on conflict(user_id) do update set
    posting_blocked=excluded.posting_blocked,
    blocked_reason=excluded.blocked_reason,
    blocked_at=excluded.blocked_at,
    blocked_by=excluded.blocked_by,
    updated_at=now();
end;
$$;

create or replace function public.admin_board_list_reports()
returns table(
  id uuid,
  reporter_id uuid,
  reporter_username text,
  reason text,
  details text,
  created_at timestamptz,
  target_text text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select r.id, r.reporter_id, p.username, r.reason, r.details, r.created_at,
    case
      when r.thread_id is not null then coalesce((select t.title from public.board_threads t where t.id=r.thread_id),'')
      else left(coalesce((select bp.body from public.board_posts bp where bp.id=r.post_id),''),120)
    end
  from public.board_reports r
  join public.profiles p on p.id=r.reporter_id
  where public.is_admin() and r.resolved_at is null
  order by r.created_at desc;
$$;

create or replace function public.admin_board_resolve_report(p_report_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  update public.board_reports set resolved_at=now(), resolved_by=auth.uid(), resolution_note=nullif(btrim(p_note),'')
  where id=p_report_id and resolved_at is null;
end;
$$;

-- 一般ユーザー公開時に使う判定ロジックを先に定義しておく。
-- 現時点では一般ユーザー向け投稿RPC/UIからは呼ばない。
create or replace function public.board_can_current_user_post()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and (public.is_admin() or (
      exists(select 1 from public.profiles p where p.id=auth.uid() and p.created_at <= now() - interval '24 hours')
      and not coalesce((select m.posting_blocked from public.board_user_moderation m where m.user_id=auth.uid()), false)
    ));
$$;

revoke all on function public.admin_board_list_threads() from public;
revoke all on function public.admin_board_get_thread(uuid) from public;
revoke all on function public.admin_board_create_thread(text,text) from public;
revoke all on function public.admin_board_update_thread(uuid,text,text) from public;
revoke all on function public.admin_board_create_reply(uuid,text) from public;
revoke all on function public.admin_board_update_reply(uuid,text) from public;
revoke all on function public.admin_board_soft_delete_thread(uuid) from public;
revoke all on function public.admin_board_soft_delete_reply(uuid) from public;
revoke all on function public.admin_board_add_image(uuid,uuid,text,text,integer,integer,integer,smallint) from public;
revoke all on function public.admin_board_remove_image_record(uuid) from public;
revoke all on function public.admin_board_list_user_states() from public;
revoke all on function public.admin_board_get_user_state(uuid) from public;
revoke all on function public.admin_board_set_user_blocked(uuid,boolean,text) from public;
revoke all on function public.admin_board_list_reports() from public;
revoke all on function public.admin_board_resolve_report(uuid,text) from public;
revoke all on function public.board_can_current_user_post() from public;

grant execute on function public.admin_board_list_threads() to authenticated;
grant execute on function public.admin_board_get_thread(uuid) to authenticated;
grant execute on function public.admin_board_create_thread(text,text) to authenticated;
grant execute on function public.admin_board_update_thread(uuid,text,text) to authenticated;
grant execute on function public.admin_board_create_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_update_reply(uuid,text) to authenticated;
grant execute on function public.admin_board_soft_delete_thread(uuid) to authenticated;
grant execute on function public.admin_board_soft_delete_reply(uuid) to authenticated;
grant execute on function public.admin_board_add_image(uuid,uuid,text,text,integer,integer,integer,smallint) to authenticated;
grant execute on function public.admin_board_remove_image_record(uuid) to authenticated;
grant execute on function public.admin_board_list_user_states() to authenticated;
grant execute on function public.admin_board_get_user_state(uuid) to authenticated;
grant execute on function public.admin_board_set_user_blocked(uuid,boolean,text) to authenticated;
grant execute on function public.admin_board_list_reports() to authenticated;
grant execute on function public.admin_board_resolve_report(uuid,text) to authenticated;
grant execute on function public.board_can_current_user_post() to authenticated;

commit;
