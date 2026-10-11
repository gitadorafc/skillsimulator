-- v4.34.7
-- 登録曲非公開ユーザーのライバル比較は「実際のスキル対象 Top25」に限定する。
--
-- v4.34.6では get_user_skill_targets() に該当曲が存在するかだけを判定していたため、
-- スキル対象外の登録曲も通過するケースがあった。
-- サイト側の skill-targets.js と同じ考え方で、
--   1) 楽器内で同一曲名の最高スキル譜面を1件だけ採用
--   2) HOT / OTHER を分けてスキル値順に各Top25
-- を満たす譜面だけを非公開ユーザーの比較対象にする。

create or replace function public.get_song_rate_comparison(p_song_id uuid)
returns table(
  user_id uuid,
  username text,
  achievement_rate numeric,
  skill numeric,
  fc text,
  play_option text,
  is_self boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
select
  p.id as user_id,
  p.username,
  us.achievement_rate,
  trunc((s.level * 20 * us.achievement_rate / 100.0)::numeric, 2) as skill,
  us.fc,
  us.play_option,
  p.id = (select auth.uid()) as is_self
from public.user_scores us
join public.profiles p
  on p.id = us.user_id
join public.songs s
  on s.id = us.song_id
where
  us.song_id = p_song_id
  and (
    -- 自分自身の登録データは常に比較対象。
    p.id = (select auth.uid())

    or (
      -- 自分が登録しているライバルだけを対象にする。
      exists (
        select 1
        from public.user_favorites f
        where f.user_id = (select auth.uid())
          and f.favorite_user_id = p.id
      )
      and (
        -- 登録曲を公開しているユーザーは、登録済みの該当譜面を比較表示。
        exists (
          select 1
          from public.get_public_user_profile(p.id) profile
          where coalesce(profile.registration_public, false)
        )

        -- 登録曲が非公開なら「実際のスキル対象 Top25」に入る譜面だけ表示。
        or exists (
          with instrument_rows as (
            select
              target.*,
              row_number() over (
                partition by target.title
                order by target.skill desc, target.song_id
              ) as title_rank
            from public.get_user_skill_targets(
              p.id,
              case when s.part like '%-D' then 'DM' else 'GF' end,
              s.version_id
            ) target
            where target.title !~* '\(CLASSIC\)\s*$'
          ),
          best_by_title as (
            select *
            from instrument_rows
            where title_rank = 1
          ),
          ranked_targets as (
            select
              best_by_title.*,
              row_number() over (
                partition by best_by_title.is_hot
                order by best_by_title.skill desc, best_by_title.title, best_by_title.song_id
              ) as target_rank
            from best_by_title
          )
          select 1
          from ranked_targets target
          where target.song_id = p_song_id
            and target.target_rank <= 25
        )
      )
    )
  )
order by
  us.achievement_rate desc,
  us.updated_at asc;
$function$;

grant execute on function public.get_song_rate_comparison(uuid) to authenticated;
