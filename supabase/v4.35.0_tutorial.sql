-- v4.35.0: 初回登録ユーザー向けチュートリアル状態
-- 既存ユーザーには自動表示せず、このSQL適用後に作成されたユーザーだけ未完了から開始する。
begin;

alter table public.profiles
  add column if not exists tutorial_completed boolean not null default true;

-- ADD COLUMN時点の既存ユーザーは true。今後作成されるprofilesは false にする。
alter table public.profiles
  alter column tutorial_completed set default false;

create or replace function public.get_my_tutorial_status()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.tutorial_completed from public.profiles p where p.id = auth.uid()),
    true
  );
$$;

create or replace function public.complete_my_tutorial()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  update public.profiles
     set tutorial_completed = true
   where id = auth.uid();

  if not found then
    raise exception 'profile not found';
  end if;

  return true;
end;
$$;

grant execute on function public.get_my_tutorial_status() to authenticated;
grant execute on function public.complete_my_tutorial() to authenticated;

commit;
