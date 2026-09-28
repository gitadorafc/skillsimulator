-- v4.29.0 掲示板スレッド一覧の作成日時 / 更新日時対応
-- 更新日時はスレッド編集では更新せず、スレッド作成日時または最終投稿日時を使用する。
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
  where public.is_admin() and t.deleted_at is null
  order by activity_at desc, t.created_at desc;
$$;

revoke all on function public.admin_board_list_threads_v2() from public;
grant execute on function public.admin_board_list_threads_v2() to authenticated;
