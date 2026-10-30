-- v4.37.0 / common song identity. Run after v4.36.12 and v4.36.13.
-- Each chart keeps its UUID; user_scores references are untouched.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

-- Canonical identity table: exact, case-sensitive matching; no automatic stripping of suffixes.
CREATE TABLE IF NOT EXISTS public.song_identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 canonical_title text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.song_identity_aliases (
 title text PRIMARY KEY,
 common_song_id uuid NOT NULL REFERENCES public.song_identities(id) ON DELETE RESTRICT
);
-- These tables do not contain user data; authenticated users can read mappings.
ALTER TABLE public.song_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_identity_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS song_identities_read ON public.song_identities;
CREATE POLICY song_identities_read ON public.song_identities FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS song_identity_aliases_read ON public.song_identity_aliases;
CREATE POLICY song_identity_aliases_read ON public.song_identity_aliases FOR SELECT TO authenticated USING(true);
-- Do not enable client-side writes.
REVOKE ALL ON public.song_identities, public.song_identity_aliases FROM anon;
GRANT SELECT ON public.song_identities, public.song_identity_aliases TO authenticated;

INSERT INTO public.song_identities(canonical_title)
SELECT DISTINCT public.canonicalize_song_title_spacing(title) FROM public.songs
ON CONFLICT(canonical_title) DO NOTHING;
INSERT INTO public.song_identity_aliases(title,common_song_id)
SELECT canonical_title,id FROM public.song_identities
ON CONFLICT(title) DO NOTHING;

-- Explicit cross-version rename. Other (GITADORA ver.) titles remain independent.
DO $link$
DECLARE root_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.songs WHERE title='Shooting Star') OR
     NOT EXISTS(SELECT 1 FROM public.songs WHERE title='Shooting Star (GITADORA ver.)') THEN
    RAISE EXCEPTION 'Shooting Star pair not found. No changes were committed';
  END IF;
  SELECT id INTO root_id FROM public.song_identities WHERE canonical_title='Shooting Star';
  INSERT INTO public.song_identity_aliases(title,common_song_id)
  VALUES ('Shooting Star (GITADORA ver.)',root_id)
  ON CONFLICT(title) DO UPDATE SET common_song_id=excluded.common_song_id;
END;
$link$;

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS common_song_id uuid;
-- Backfill current data. Never change songs.id.
UPDATE public.songs s SET common_song_id=a.common_song_id
FROM public.song_identity_aliases a
WHERE a.title=public.canonicalize_song_title_spacing(s.title)
 AND s.common_song_id IS DISTINCT FROM a.common_song_id;
ALTER TABLE public.songs ALTER COLUMN common_song_id SET NOT NULL;
DO $fk$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='songs_common_song_id_fkey') THEN
  ALTER TABLE public.songs ADD CONSTRAINT songs_common_song_id_fkey
    FOREIGN KEY(common_song_id) REFERENCES public.song_identities(id);
 END IF;
END;
$fk$;
CREATE INDEX IF NOT EXISTS songs_common_song_id_part_idx ON public.songs(common_song_id,part);

-- New charts obtain a shared identity on insertion or title change.
CREATE OR REPLACE FUNCTION public.set_song_common_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE resolved uuid; normalized text;
BEGIN
 normalized:=public.canonicalize_song_title_spacing(NEW.title);
 SELECT common_song_id INTO resolved FROM public.song_identity_aliases WHERE title=normalized;
 IF resolved IS NULL THEN
   INSERT INTO public.song_identities(canonical_title) VALUES(normalized)
   ON CONFLICT(canonical_title) DO UPDATE SET canonical_title=excluded.canonical_title
   RETURNING id INTO resolved;
   INSERT INTO public.song_identity_aliases(title,common_song_id) VALUES(normalized,resolved)
   ON CONFLICT(title) DO UPDATE SET common_song_id=excluded.common_song_id;
 END IF;
 NEW.common_song_id:=resolved;
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS songs_common_identity_sync ON public.songs;
CREATE TRIGGER songs_common_identity_sync BEFORE INSERT OR UPDATE OF title ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.set_song_common_identity();

-- Historical option/comment lookup by shared identity instead of title string comparison.
CREATE OR REPLACE FUNCTION public.get_my_previous_score_settings(
 p_title text,p_part text,p_version_id uuid
) RETURNS TABLE(play_option text,private_comment text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
WITH target AS (
 SELECT gv.sort_order,s.common_song_id
 FROM public.songs s JOIN public.game_versions gv ON gv.id=s.version_id
 WHERE s.version_id=p_version_id AND s.part=p_part
   AND s.title=public.canonicalize_song_title_spacing(p_title)
 LIMIT 1
), history AS (
 SELECT CASE WHEN p_part LIKE '%-D' THEN 'NORMAL'
          ELSE coalesce(nullif(us.play_option,''),'NORMAL') END AS play_option,
        us.private_comment,v.sort_order,us.updated_at
 FROM public.user_scores us
 LEFT JOIN public.songs s ON s.id=us.song_id
 LEFT JOIN public.song_requests sr ON sr.id=us.song_request_id
 JOIN public.game_versions v ON v.id=coalesce(s.version_id,sr.version_id)
 CROSS JOIN target t
 WHERE us.user_id=auth.uid() AND coalesce(s.part,sr.part)=p_part
   AND v.sort_order < t.sort_order
   AND (s.common_song_id=t.common_song_id OR
        (s.id IS NULL AND EXISTS(
          SELECT 1 FROM public.song_identity_aliases a
          WHERE a.title=public.canonicalize_song_title_spacing(sr.title)
            AND a.common_song_id=t.common_song_id)))
)
SELECT h.play_option,h.private_comment FROM history h
ORDER BY h.sort_order DESC,h.updated_at DESC LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public.get_my_previous_score_settings(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_previous_score_settings(text,text,uuid) TO authenticated;

-- Personal best across versions now uses shared IDs, not title comparison.
CREATE OR REPLACE FUNCTION public.get_song_personal_best_history_v2(p_song_id uuid)
RETURNS TABLE(achievement_rate numeric,version_name text,version_code text,recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
WITH target AS (
 SELECT s.common_song_id,s.part FROM public.songs s WHERE s.id=p_song_id
), history AS (
 SELECT us.achievement_rate,gv.name version_name,gv.code version_code,
 us.updated_at recorded_at,gv.sort_order
 FROM public.user_scores us
 JOIN public.songs s ON s.id=us.song_id
 JOIN public.game_versions gv ON gv.id=s.version_id
 JOIN target t ON t.common_song_id=s.common_song_id AND t.part=s.part
 WHERE us.user_id=auth.uid()
)
SELECT achievement_rate,version_name,version_code,recorded_at
FROM history ORDER BY achievement_rate DESC,sort_order DESC,recorded_at DESC LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public.get_song_personal_best_history_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_song_personal_best_history_v2(uuid) TO authenticated;

-- Preserve distinct per-version titles. Tests of the shared identity are mandatory.
DO $test$
DECLARE n int;
BEGIN
 SELECT count(DISTINCT common_song_id) INTO n FROM public.songs
 WHERE title IN ('Shooting Star','Shooting Star (GITADORA ver.)');
 IF n<>1 THEN RAISE EXCEPTION 'Shooting Star common ID validation failed'; END IF;
 SELECT count(DISTINCT common_song_id) INTO n FROM public.songs
 WHERE title IN ('Fireball','FIREBALL');
 IF n=1 AND EXISTS(SELECT 1 FROM public.songs WHERE title='Fireball')
        AND EXISTS(SELECT 1 FROM public.songs WHERE title='FIREBALL') THEN
 RAISE EXCEPTION 'Fireball and FIREBALL must remain distinct'; END IF;
END;
$test$;

-- Admin image listing: direct image first, alternate-title fallback only for common identity.
create or replace function public.admin_list_song_master_jackets(
  p_search text default '',
  p_limit integer default 100,
  p_offset integer default 0,
  p_version_id uuid default null,
  p_type_filter text default '',
  p_image_filter text default ''
)
returns table(
  title text,
  initial_group text,
  official_order numeric,
  is_hot boolean,
  levels jsonb,
  jacket_image_url text,
  jacket_storage_path text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with grouped as (
    select
      s.title,
      max(s.initial_group) as initial_group,
      min(s.official_order) as official_order,
      bool_or(s.is_hot) as is_hot,
      jsonb_object_agg(s.part, s.level order by s.part) as levels,
      max(coalesce(j.image_url, shared_j.image_url)) as jacket_image_url,
      max(coalesce(j.storage_path, shared_j.storage_path)) as jacket_storage_path
    from public.songs s
    left join public.song_jackets j on j.title = s.title
    left join lateral (
      select sj.image_url, sj.storage_path
      from public.songs linked
      join public.song_jackets sj on sj.title = linked.title
      where linked.common_song_id = s.common_song_id
        and linked.title <> s.title
        and s.title IN ('Shooting Star','Shooting Star (GITADORA ver.)')
      order by (sj.storage_path is not null) desc, linked.title
      limit 1
    ) shared_j on j.title is null
    where (p_version_id is null or s.version_id = p_version_id)
      and (
        btrim(coalesce(p_search, '')) = ''
        or s.title ilike '%' || btrim(p_search) || '%'
        or coalesce(s.initial_group, '') ilike '%' || btrim(p_search) || '%'
      )
      and (
        upper(btrim(coalesce(p_type_filter, ''))) = ''
        or (upper(btrim(p_type_filter)) = 'HOT' and s.is_hot)
        or (upper(btrim(p_type_filter)) = 'OTHER' and not s.is_hot)
      )
      and (
        upper(btrim(coalesce(p_image_filter, ''))) = ''
        or (upper(btrim(p_image_filter)) = 'WITH' and (coalesce(j.image_url, shared_j.image_url) is not null or coalesce(j.storage_path, shared_j.storage_path) is not null))
        or (upper(btrim(p_image_filter)) = 'WITHOUT' and coalesce(j.image_url, shared_j.image_url) is null and coalesce(j.storage_path, shared_j.storage_path) is null)
      )
    group by s.title
  ), ranked as (
    select
      g.*,
      case
        when g.initial_group = '記号・数字' then 0
        when g.initial_group ~ '^[A-Z]$' then ascii(g.initial_group) - ascii('A') + 1
        when g.initial_group = 'あ行' then 27
        when g.initial_group = 'か行' then 28
        when g.initial_group = 'さ行' then 29
        when g.initial_group = 'た行' then 30
        when g.initial_group = 'な行' then 31
        when g.initial_group = 'は行' then 32
        when g.initial_group = 'ま行' then 33
        when g.initial_group = 'や行' then 34
        when g.initial_group = 'ら行' then 35
        when g.initial_group = 'わ行' then 36
        else 999
      end as initial_rank
    from grouped g
  )
  select
    r.title,
    r.initial_group,
    r.official_order,
    r.is_hot,
    r.levels,
    r.jacket_image_url,
    r.jacket_storage_path,
    count(*) over() as total_count
  from ranked r
  order by
    r.initial_rank,
    r.official_order nulls last,
    r.title
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

COMMIT;

SELECT title, version_id, part, common_song_id FROM public.songs WHERE title IN ('Shooting Star','Shooting Star (GITADORA ver.)') ORDER BY title,part LIMIT 24;
