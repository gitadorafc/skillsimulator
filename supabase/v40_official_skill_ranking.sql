-- v4.20.0 公式スキルランキング（開発者限定）
begin;

create table if not exists public.official_skill_rankings (
  version_id uuid not null references public.game_versions(id) on delete cascade,
  instrument text not null check (instrument in ('GF', 'DM')),
  rank integer not null check (rank between 1 and 100),
  player_name text not null,
  skill numeric(7,2) not null check (skill between 0 and 10000),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (version_id, instrument, rank)
);

alter table public.official_skill_rankings enable row level security;
revoke all on table public.official_skill_rankings from anon, authenticated;

create or replace function public.replace_official_skill_ranking(
  p_version_id uuid,
  p_instrument text,
  p_rows jsonb,
  p_captured_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_primary_admin() then
    raise exception 'この機能は開発者専用です。';
  end if;
  if p_instrument not in ('GF', 'DM') then raise exception '機種が不正です。'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then raise exception 'データ形式が不正です。'; end if;
  v_count := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  if v_count < 1 or v_count > 100 then raise exception 'ランキングは1～100件で登録してください。'; end if;

  delete from public.official_skill_rankings
  where version_id = p_version_id and instrument = p_instrument;

  insert into public.official_skill_rankings(version_id, instrument, rank, player_name, skill, captured_at)
  select p_version_id, p_instrument, ordinality::integer,
         btrim(value->>'player_name'), (value->>'skill')::numeric, p_captured_at
  from jsonb_array_elements(p_rows) with ordinality
  where btrim(coalesce(value->>'player_name', '')) <> '';

  if (select count(*) from public.official_skill_rankings where version_id = p_version_id and instrument = p_instrument) <> v_count then
    raise exception '空のプレイヤー名が含まれています。';
  end if;
  return v_count;
end;
$$;

create or replace function public.get_official_skill_ranking(p_version_id uuid, p_instrument text)
returns table(rank integer, player_name text, skill numeric, captured_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_primary_admin() then
    raise exception 'この機能は開発者専用です。';
  end if;
  return query
    select r.rank, r.player_name, r.skill, r.captured_at
    from public.official_skill_rankings r
    where r.version_id = p_version_id and r.instrument = p_instrument
    order by r.rank;
end;
$$;

create or replace function public.replace_official_skill_rankings(
  p_version_id uuid,
  p_rankings jsonb,
  p_captured_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer := 0;
  v_instrument text;
begin
  if auth.uid() is null or not public.is_primary_admin() then
    raise exception 'この機能は開発者専用です。';
  end if;
  if jsonb_typeof(coalesce(p_rankings, '{}'::jsonb)) <> 'object' then
    raise exception 'データ形式が不正です。';
  end if;
  foreach v_instrument in array array['GF', 'DM'] loop
    if not (p_rankings ? v_instrument) then raise exception '%のランキングがありません。', v_instrument; end if;
    v_total := v_total + public.replace_official_skill_ranking(
      p_version_id, v_instrument, p_rankings->v_instrument, p_captured_at
    );
  end loop;
  return v_total;
end;
$$;

revoke all on function public.replace_official_skill_ranking(uuid,text,jsonb,timestamptz) from public;
revoke all on function public.get_official_skill_ranking(uuid,text) from public;
revoke all on function public.replace_official_skill_rankings(uuid,jsonb,timestamptz) from public;
grant execute on function public.replace_official_skill_ranking(uuid,text,jsonb,timestamptz) to authenticated;
grant execute on function public.get_official_skill_ranking(uuid,text) to authenticated;
grant execute on function public.replace_official_skill_rankings(uuid,jsonb,timestamptz) to authenticated;

commit;
