-- Append the master ordering column without disturbing existing view columns.
create or replace view public.my_score_details
with (security_invoker = true)
as
select
  us.id as score_id,
  us.user_id,
  us.song_id,
  us.song_request_id,
  coalesce(s.is_hot, false) as is_hot,
  coalesce(s.title, sr.title) as title,
  coalesce(s.part, sr.part) as part,
  coalesce(s.level, sr.proposed_level) as level,
  us.achievement_rate,
  us.fc,
  us.play_option,
  trunc((coalesce(s.level, sr.proposed_level) * 20 * us.achievement_rate / 100.0)::numeric, 2) as skill,
  (us.song_request_id is not null) as pending_master,
  sr.status as request_status,
  us.created_at,
  us.updated_at,
  coalesce(s.version_id, sr.version_id) as version_id,
  gv.name as version_name,
  s.official_order as official_order
from public.user_scores us
left join public.songs s on s.id = us.song_id
left join public.song_requests sr on sr.id = us.song_request_id
left join public.game_versions gv
  on gv.id = coalesce(s.version_id, sr.version_id)
where us.user_id = auth.uid();

grant select on public.my_score_details to authenticated;

-- v4.36.2: Equal skill tie-break: level DESC, songs.official_order ASC.
-- Keep the server-side private rival Top25 choice aligned with the site.
-- Apply after prior schema migrations, including v4.34.7.

create or replace function public.get_user_skill_targets(
  p_user_id uuid,
  p_instrument text default 'GF',
  p_version_id uuid default null
)
returns table(
  score_id uuid,
  song_id uuid,
  is_hot boolean,
  title text,
  part text,
  level numeric,
  achievement_rate numeric,
  skill numeric,
  fc text,
  play_option text
)
language sql
stable
security definer
set search_path = ''
as $$
with target_version as (
  select coalesce(
    p_version_id,
    (select gv.id
     from public.game_versions gv
     where gv.is_current = true
     order by gv.sort_order desc
     limit 1)
  ) as id
),
scored as (
  select
    us.id as score_id,
    us.song_id,
    s.is_hot,
    s.title,
    s.part,
    s.level,
    s.official_order,
    us.achievement_rate,
    trunc((s.level * 20 * us.achievement_rate / 100.0)::numeric, 2) as skill,
    us.fc,
    us.play_option,
    us.updated_at
  from public.user_scores us
  join public.songs s on s.id = us.song_id
  cross join target_version tv
  where us.user_id = p_user_id
    and s.version_id = tv.id
    and s.title !~* '\(CLASSIC\)[[:space:]]*$'
    and (
      (upper(coalesce(p_instrument,'GF')) = 'DM' and s.part like '%-D')
      or
      (upper(coalesce(p_instrument,'GF')) <> 'DM' and (s.part like '%-G' or s.part like '%-B'))
    )
),
ranked as (
  select *,
    row_number() over(
      partition by title
      order by skill desc, level desc, official_order asc nulls last, updated_at desc, song_id
    ) as title_rank
  from scored
)
select
  score_id, song_id, is_hot, title, part, level,
  achievement_rate, skill, fc, play_option
from ranked
where title_rank = 1
order by skill desc, level desc, official_order asc nulls last, title collate "C", song_id;
$$;

revoke execute on function public.get_user_skill_targets(uuid,text,uuid) from public, anon;
grant execute on function public.get_user_skill_targets(uuid,text,uuid) to authenticated;

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
                order by target.skill desc, target.level desc, (select ss.official_order from public.songs ss where ss.id = target.song_id) asc nulls last, target.song_id
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
                order by best_by_title.skill desc, best_by_title.level desc, (select ss.official_order from public.songs ss where ss.id = best_by_title.song_id) asc nulls last, best_by_title.title collate "C", best_by_title.song_id
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
