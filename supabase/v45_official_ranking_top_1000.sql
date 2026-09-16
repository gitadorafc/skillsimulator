-- v4.23.0 公式スキルランキングをGF・DM各1000位まで保存
begin;

alter table public.official_skill_rankings
  drop constraint if exists official_skill_rankings_rank_check;
alter table public.official_skill_rankings
  add constraint official_skill_rankings_rank_check check (rank between 1 and 1000);

create or replace function public.store_official_skill_ranking(
  p_version_id uuid,
  p_instrument text,
  p_rows jsonb,
  p_captured_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_instrument not in ('GF', 'DM') then raise exception '機種が不正です。'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'データ形式が不正です。';
  end if;
  v_count := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  if v_count < 1 or v_count > 1000 then
    raise exception 'ランキングは1～1000件で登録してください。';
  end if;

  delete from public.official_skill_rankings
  where version_id = p_version_id and instrument = p_instrument;

  insert into public.official_skill_rankings(version_id, instrument, rank, player_name, skill, captured_at)
  select p_version_id, p_instrument, ordinality::integer,
         btrim(value->>'player_name'), (value->>'skill')::numeric, p_captured_at
  from jsonb_array_elements(p_rows) with ordinality
  where btrim(coalesce(value->>'player_name', '')) <> '';

  if (select count(*) from public.official_skill_rankings
      where version_id = p_version_id and instrument = p_instrument) <> v_count then
    raise exception '空のプレイヤー名が含まれています。';
  end if;
  return v_count;
end;
$$;

revoke all on function public.store_official_skill_ranking(uuid,text,jsonb,timestamptz)
  from public, anon, authenticated;

commit;
