-- v32: 管理者の曲マスター複合更新を単一トランザクションへまとめる。

begin;

-- CSV・横一括編集用。
-- 既存の保存RPCとふりがな状態更新RPCを同一トランザクション内で実行する。
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
begin
  if not public.is_admin() then
    raise exception '管理者権限がありません。';
  end if;

  select public.admin_bulk_save_song_master(p_rows, p_version_id)
    into v_saved;

  perform public.admin_update_song_reading_status(p_rows);

  return coalesce(v_saved, 0);
end;
$$;

revoke all on function public.admin_save_song_master_rows_atomic(jsonb, uuid)
  from public, anon;
grant execute on function public.admin_save_song_master_rows_atomic(jsonb, uuid)
  to authenticated, service_role;

-- 1譜面追加・編集用。
-- 対象譜面の保存と同名曲全譜面へのHOT反映を同一トランザクション内で実行する。
create or replace function public.admin_save_song_master_atomic(
  p_id uuid,
  p_is_hot boolean,
  p_title text,
  p_part text,
  p_level numeric,
  p_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if not public.is_admin() then
    raise exception '管理者権限がありません。';
  end if;

  if p_version_id is null then
    raise exception 'バージョンを選択してください。';
  end if;
  if v_title = '' then
    raise exception '曲名を入力してください。';
  end if;
  if p_part is null or p_part not in (
    'BSC-G','ADV-G','EXT-G','MAS-G',
    'BSC-B','ADV-B','EXT-B','MAS-B',
    'BSC-D','ADV-D','EXT-D','MAS-D'
  ) then
    raise exception 'Partが不正です。';
  end if;
  if p_level is null or p_level <= 0 or p_level > 9.99 then
    raise exception '難易度は0.01～9.99の範囲で入力してください。';
  end if;

  if p_id is null then
    insert into public.songs(title, part, level, is_hot, version_id)
    values (v_title, p_part, trunc(p_level, 2), coalesce(p_is_hot, false), p_version_id)
    returning id into v_id;
  else
    update public.songs
    set
      title = v_title,
      part = p_part,
      level = trunc(p_level, 2),
      is_hot = coalesce(p_is_hot, false),
      version_id = p_version_id
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception '対象の譜面が見つかりません。';
    end if;
  end if;

  update public.songs
  set is_hot = coalesce(p_is_hot, false)
  where version_id = p_version_id
    and title = v_title;

  return v_id;
end;
$$;

revoke all on function public.admin_save_song_master_atomic(
  uuid, boolean, text, text, numeric, uuid
) from public, anon;
grant execute on function public.admin_save_song_master_atomic(
  uuid, boolean, text, text, numeric, uuid
) to authenticated, service_role;

commit;
