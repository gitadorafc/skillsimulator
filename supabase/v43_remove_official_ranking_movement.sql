-- v4.21.1 同一プレイヤーを識別できないため公式ランキングの変動比較を廃止
begin;

drop function if exists public.get_official_skill_ranking(uuid, text);

alter table public.official_skill_rankings
  drop column if exists previous_rank;

create function public.get_official_skill_ranking(p_version_id uuid, p_instrument text)
returns table(rank integer, player_name text, skill numeric, captured_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'この機能は管理者専用です。';
  end if;
  return query
    select r.rank, r.player_name, r.skill, r.captured_at
    from public.official_skill_rankings r
    where r.version_id = p_version_id and r.instrument = p_instrument
    order by r.rank;
end;
$$;

revoke all on function public.get_official_skill_ranking(uuid,text) from public;
grant execute on function public.get_official_skill_ranking(uuid,text) to authenticated;

commit;
