-- v4.36.13 Shooting Star 公式改題の個別エイリアス対応
-- 曲ID・曲名・スコア・ジャケットの既存データは変更しない。
-- v4.36.12のDB正規化移行を適用済みであること。
-- 保存表記の正規化関数 canonicalize_song_title_spacing() は変更しない。
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- 別バージョンの改題のみを対象とする。現在表示する公式の曲名は維持。
-- 旧関数の引数名を維持してCREATE OR REPLACEする。
DO $migration$
DECLARE args text;
BEGIN
  SELECT pg_catalog.pg_get_function_arguments(
    pg_catalog.to_regprocedure('public.normalize_song_title_for_match(text)')) INTO args;
  IF args IS NULL THEN
    RAISE EXCEPTION 'normalize_song_title_for_match(text) が見つかりません。v4.36.12のDB適用を確認してください';
  END IF;
  EXECUTE format($ddl$
    CREATE OR REPLACE FUNCTION public.normalize_song_title_for_match(%s)
    RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
      SELECT CASE public.canonicalize_song_title_spacing($1)
        WHEN 'Shooting Star (GITADORA ver.)' THEN 'Shooting Star'
        ELSE public.canonicalize_song_title_spacing($1)
      END;
    $fn$;
  $ddl$, args);
END;
$migration$;

-- 表記違いは別バージョンでのみ存在する想定。同一バージョン・同一パート
-- に両方が存在する場合は曖昧になるため中断する。
DO $guard$
DECLARE conflict_count bigint;
BEGIN
 SELECT count(*) INTO conflict_count FROM (
    SELECT version_id, part FROM public.songs
    WHERE title IN ('Shooting Star','Shooting Star (GITADORA ver.)')
    GROUP BY version_id, part HAVING count(DISTINCT title) > 1
 ) x;
 IF conflict_count > 0 THEN
   RAISE EXCEPTION 'Shooting Starの同一バージョン内重複があるため中止（%件）',conflict_count;
 END IF;
END;
$guard$;

-- 関数を参照する式インデックスがある場合に既存計算結果を更新する。
-- v4.36.12で作成されたインデックス。
DO $rebuild$
BEGIN
 IF to_regclass('public.songs_version_part_normalized_title_idx') IS NOT NULL THEN
   EXECUTE 'REINDEX INDEX public.songs_version_part_normalized_title_idx';
 END IF;
END;
$rebuild$;

-- 誤統合防止用の自己検査。
DO $verify$
BEGIN
 IF public.normalize_song_title_for_match('Shooting Star') <>
    public.normalize_song_title_for_match('Shooting Star (GITADORA ver.)')
    OR public.normalize_song_title_for_match('Fireball') =
       public.normalize_song_title_for_match('FIREBALL')
    OR public.normalize_song_title_for_match('Shooting Star (CLASSIC)') =
       public.normalize_song_title_for_match('Shooting Star') THEN
   RAISE EXCEPTION '改題の照合確認に失敗しました';
 END IF;
END;
$verify$;
COMMIT;

-- 実行後の確認結果
SELECT s.title, gv.name AS version_name, count(*) AS chart_count
FROM public.songs s JOIN public.game_versions gv ON gv.id = s.version_id
WHERE s.title IN ('Shooting Star','Shooting Star (GITADORA ver.)')
GROUP BY s.title,gv.name ORDER BY gv.name,s.title;
