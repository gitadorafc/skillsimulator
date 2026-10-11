-- v4.34.6
-- ライバル比較の公開範囲を「登録曲の公開設定」に合わせる。
--
-- 仕様:
--   * 自分自身は従来どおり表示する。
--   * ライバルが登録曲を公開している場合は、登録済みの該当譜面を比較に表示する。
--   * ライバルが登録曲を非公開にしている場合は、現在のスキル対象に入っている譜面だけ表示する。
--
-- フロント側で隠すのではなくRPC側で制御し、非公開の登録曲データを比較結果として返さない。

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
        -- 登録曲を公開しているユーザーは、従来どおり登録済み譜面を表示。
        exists (
          select 1
          from public.get_public_user_profile(p.id) profile
          where coalesce(profile.registration_public, false)
        )

        -- 登録曲が非公開なら、該当譜面が現在のスキル対象に入っている場合だけ表示。
        or exists (
          select 1
          from public.get_user_skill_targets(
            p.id,
            case when s.part like '%-D' then 'DM' else 'GF' end,
            s.version_id
          ) target
          where target.song_id = p_song_id
        )
      )
    )
  )
order by
  us.achievement_rate desc,
  us.updated_at asc;
$function$;

grant execute on function public.get_song_rate_comparison(uuid) to authenticated;
