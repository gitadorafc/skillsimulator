-- v4.19.0 登録曲タグを全ユーザーへ開放
drop policy if exists user_tags_admin_select on public.user_tags;
drop policy if exists user_tags_owner_select on public.user_tags;
create policy user_tags_owner_select on public.user_tags for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_score_tags_admin_select on public.user_score_tags;
drop policy if exists user_score_tags_owner_select on public.user_score_tags;
create policy user_score_tags_owner_select on public.user_score_tags for select to authenticated
  using (
    exists (
      select 1 from public.user_scores s
      where s.id = user_score_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.user_tags t
      where t.id = tag_id and t.user_id = auth.uid()
    )
  );

create or replace function public.replace_my_tags(p_tags jsonb)
returns setof public.user_tags
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_name text;
  v_keep_ids uuid[] := '{}'::uuid[];
  v_position integer := 0;
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  if jsonb_typeof(coalesce(p_tags, '[]'::jsonb)) <> 'array' then
    raise exception 'タグの形式が不正です。';
  end if;
  if jsonb_array_length(coalesce(p_tags, '[]'::jsonb)) > 10 then
    raise exception 'タグは10個までです。';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) x
    group by lower(btrim(x->>'name')) having count(*) > 1
  ) then
    raise exception '同じ名前のタグは登録できません。';
  end if;

  update public.user_tags
  set name = '~' || substr(replace(id::text, '-', ''), 1, 12), updated_at = now()
  where user_id = auth.uid();

  for v_item in select value from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) loop
    v_name := btrim(coalesce(v_item->>'name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 20 then
      raise exception 'タグ名は1～20文字で入力してください。';
    end if;

    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is null then
      insert into public.user_tags (user_id, name, sort_order)
      values (auth.uid(), v_name, v_position)
      returning id into v_id;
    else
      update public.user_tags
      set name = v_name, sort_order = v_position, updated_at = now()
      where id = v_id and user_id = auth.uid();
      if not found then raise exception '編集できないタグが含まれています。'; end if;
    end if;
    v_keep_ids := array_append(v_keep_ids, v_id);
    v_position := v_position + 1;
  end loop;

  delete from public.user_tags
  where user_id = auth.uid() and not (id = any(v_keep_ids));

  return query select * from public.user_tags
    where user_id = auth.uid() order by sort_order;
end;
$$;

create or replace function public.set_my_score_tags(p_score_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tag_ids uuid[] := coalesce(p_tag_ids, '{}'::uuid[]);
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  if not exists (
    select 1 from public.user_scores where id = p_score_id and user_id = auth.uid()
  ) then
    raise exception '登録データが見つかりません。';
  end if;
  if cardinality(v_tag_ids) > 10 then raise exception 'タグは10個までです。'; end if;
  if exists (
    select 1 from unnest(v_tag_ids) tag_id
    where not exists (
      select 1 from public.user_tags t where t.id = tag_id and t.user_id = auth.uid()
    )
  ) then
    raise exception '利用できないタグが含まれています。';
  end if;

  delete from public.user_score_tags where user_score_id = p_score_id;
  insert into public.user_score_tags (user_score_id, tag_id)
    select p_score_id, tag_id from (select distinct unnest(v_tag_ids) as tag_id) x;
end;
$$;

revoke all on function public.replace_my_tags(jsonb) from public;
revoke all on function public.set_my_score_tags(uuid, uuid[]) from public;
grant execute on function public.replace_my_tags(jsonb) to authenticated;
grant execute on function public.set_my_score_tags(uuid, uuid[]) to authenticated;
