-- v31: ゲームバージョンの並び替え・削除
-- 既存の admin_create_game_version と同じ方針:
--   ・SECURITY DEFINER + search_path固定 + is_admin()チェック
--   ・game_versions テーブル自体にはUPDATE/DELETEのRLSポリシーを追加しない
--     (このRPC経由のみで変更できるようにする)

-- ============================================================
-- 1. 並び替え
-- ============================================================
-- p_version_ids には「表示したい順番」で全バージョンIDを並べて渡す。
-- 例: ['新しいバージョンのid', '1個前のid', ...]
-- 先頭ほど sort_order が大きくなる (既存の ORDER BY sort_order DESC と一致)。
CREATE OR REPLACE FUNCTION public.admin_reorder_game_versions(
  p_version_ids uuid[]
) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SECURITY DEFINER
    AS $$
declare
  v_total int := coalesce(array_length(p_version_ids, 1), 0);
  v_existing_count int;
  v_id uuid;
  v_index int;
begin
  if not public.is_admin() then
    raise exception '管理者権限がありません。';
  end if;

  if v_total = 0 then
    raise exception '並び替える対象がありません。';
  end if;

  -- 渡された配列が「現存する全バージョン」と過不足なく一致しているかを確認する
  -- (一部だけ渡されると欠けたバージョンのsort_orderが不定になるため)
  select count(*) into v_existing_count from public.game_versions;
  if v_existing_count <> v_total
     or v_existing_count <> (select count(distinct v) from unnest(p_version_ids) v)
  then
    raise exception '並び替え対象のバージョン一覧が最新の状態と一致しません。画面を再読み込みしてください。';
  end if;

  v_index := v_total;
  foreach v_id in array p_version_ids loop
    update public.game_versions
      set sort_order = v_index
      where id = v_id;
    if not found then
      raise exception '存在しないバージョンが含まれています。';
    end if;
    v_index := v_index - 1;
  end loop;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_reorder_game_versions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_game_versions(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reorder_game_versions(uuid[]) TO service_role;

-- ============================================================
-- 2. 削除
-- ============================================================
-- 安全のため、以下はブロックする:
--   ・「現在のバージョン」フラグが立っているもの (先にSQLで is_current を移してから)
--   ・唯一残っているバージョン
--   ・songs / song_requests が1件でも紐づいているもの (ON DELETE RESTRICTと同じ判断を先にわかりやすく通知)
CREATE OR REPLACE FUNCTION public.admin_delete_game_version(
  p_version_id uuid
) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SECURITY DEFINER
    AS $$
declare
  v_is_current boolean;
  v_total int;
  v_song_count int;
  v_request_count int;
begin
  if not public.is_admin() then
    raise exception '管理者権限がありません。';
  end if;

  select is_current into v_is_current
    from public.game_versions
    where id = p_version_id;

  if v_is_current is null then
    raise exception '指定されたバージョンが見つかりません。';
  end if;

  if v_is_current then
    raise exception '「現在のバージョン」は削除できません。先に別のバージョンを現在のバージョンにしてください。';
  end if;

  select count(*) into v_total from public.game_versions;
  if v_total <= 1 then
    raise exception '最後の1件は削除できません。';
  end if;

  select count(*) into v_song_count
    from public.songs where version_id = p_version_id;
  select count(*) into v_request_count
    from public.song_requests where version_id = p_version_id;

  if v_song_count > 0 or v_request_count > 0 then
    raise exception
      'このバージョンには曲マスター%件・登録依頼%件が残っているため削除できません。先にそれらを削除・移行してください。',
      v_song_count, v_request_count;
  end if;

  delete from public.game_versions where id = p_version_id;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_game_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_game_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_game_version(uuid) TO service_role;
