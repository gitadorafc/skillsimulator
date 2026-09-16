-- v4.22.0 公式スキルランキングをログインユーザーへ公開
begin;

create or replace function public.get_official_skill_ranking(p_version_id uuid, p_instrument text)
returns table(rank integer, player_name text, skill numeric, captured_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です。';
  end if;
  if p_instrument not in ('GF', 'DM') then
    raise exception '機種が不正です。';
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
