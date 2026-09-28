-- v48: 管理者向け掲示板UI改修で使用する通報作成RPC
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
  if p_thread_id is not null and not exists(
    select 1 from public.board_threads where id=p_thread_id and deleted_at is null
  ) then
    raise exception '対象スレッドがありません。';
  end if;
  if p_post_id is not null and not exists(
    select 1 from public.board_posts where id=p_post_id and deleted_at is null
  ) then
    raise exception '対象の返信がありません。';
  end if;

  insert into public.board_reports(reporter_id, thread_id, post_id, reason, details)
  values(auth.uid(), p_thread_id, p_post_id, v_reason, v_details)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_board_create_report(uuid,uuid,text,text) from public;
grant execute on function public.admin_board_create_report(uuid,uuid,text,text) to authenticated;
