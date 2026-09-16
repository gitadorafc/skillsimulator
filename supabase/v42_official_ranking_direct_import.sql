-- v4.21.0 公式ランキングの直接取込
begin;

create table if not exists public.official_ranking_import_tokens (
  token uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.game_versions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.official_ranking_import_tokens enable row level security;
revoke all on table public.official_ranking_import_tokens from anon, authenticated;

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

revoke all on function public.store_official_skill_ranking(uuid,text,jsonb,timestamptz) from public, anon, authenticated;

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
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  return public.store_official_skill_ranking(p_version_id, p_instrument, p_rows, p_captured_at);
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
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  if jsonb_typeof(coalesce(p_rankings, '{}'::jsonb)) <> 'object' then raise exception 'データ形式が不正です。'; end if;
  foreach v_instrument in array array['GF', 'DM'] loop
    if not (p_rankings ? v_instrument) then raise exception '%のランキングがありません。', v_instrument; end if;
    v_total := v_total + public.store_official_skill_ranking(
      p_version_id, v_instrument, p_rankings->v_instrument, p_captured_at
    );
  end loop;
  return v_total;
end;
$$;

create or replace function public.get_official_skill_ranking(p_version_id uuid, p_instrument text)
returns table(rank integer, player_name text, skill numeric, captured_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  return query
    select r.rank, r.player_name, r.skill, r.captured_at
    from public.official_skill_rankings r
    where r.version_id = p_version_id and r.instrument = p_instrument
    order by r.rank;
end;
$$;

create or replace function public.create_official_ranking_import_token(p_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'この機能は管理者専用です。'; end if;
  delete from public.official_ranking_import_tokens
  where expires_at < now() or used_at is not null;
  insert into public.official_ranking_import_tokens(version_id, created_by)
  values (p_version_id, auth.uid()) returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.consume_official_ranking_import(
  p_token uuid,
  p_rankings jsonb,
  p_captured_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token_row public.official_ranking_import_tokens%rowtype;
  v_instrument text;
  v_total integer := 0;
begin
  select * into v_token_row
  from public.official_ranking_import_tokens
  where token = p_token
  for update;
  if not found or v_token_row.used_at is not null or v_token_row.expires_at < now() then
    raise exception '取込トークンが無効または期限切れです。';
  end if;
  if jsonb_typeof(coalesce(p_rankings, '{}'::jsonb)) <> 'object' then raise exception 'データ形式が不正です。'; end if;
  foreach v_instrument in array array['GF', 'DM'] loop
    if not (p_rankings ? v_instrument) then raise exception '%のランキングがありません。', v_instrument; end if;
    v_total := v_total + public.store_official_skill_ranking(
      v_token_row.version_id, v_instrument, p_rankings->v_instrument, p_captured_at
    );
  end loop;
  update public.official_ranking_import_tokens set used_at = now() where token = p_token;
  return v_total;
end;
$$;

revoke all on function public.create_official_ranking_import_token(uuid) from public;
revoke all on function public.consume_official_ranking_import(uuid,jsonb,timestamptz) from public;
grant execute on function public.create_official_ranking_import_token(uuid) to authenticated;
grant execute on function public.consume_official_ranking_import(uuid,jsonb,timestamptz) to anon, authenticated;
grant execute on function public.get_official_skill_ranking(uuid,text) to authenticated;

commit;
