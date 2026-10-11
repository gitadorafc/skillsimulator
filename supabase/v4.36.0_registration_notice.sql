-- v4.36.0: 実行時点で登録曲非公開の既存ユーザーだけを対象に固定する。
-- 適用前に既存の get_public_user_profile(uuid) が利用できることを確認する。
begin;

-- 初回だけ既存ユーザーの公開状態をスナップショットする。
-- 再適用時は一度回答したユーザーの確認状態を戻さない。
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'registration_public_notice_pending'
  ) then
    alter table public.profiles
      add column registration_public_notice_pending boolean not null default false;

    update public.profiles p
       set registration_public_notice_pending = true
     where exists (
       select 1 from public.get_public_user_profile(p.id) pub
        where coalesce(pub.registration_public, false) = false
     );
  end if;
end;
$$;

create or replace function public.get_my_registration_notice_status()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.registration_public_notice_pending
    from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.complete_my_registration_notice(p_make_public boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pending boolean;
begin
  if v_user is null then raise exception 'login required'; end if;
  select registration_public_notice_pending into v_pending
    from public.profiles where id = v_user for update;
  if not found then raise exception 'profile not found'; end if;
  if not v_pending then return true; end if;
  if coalesce(p_make_public,false) then
    -- 現行の公開設定更新RPCを使い、X公開設定は現在値を保持する。
    perform public.set_my_feature_settings(
      true,
      coalesce((select (to_jsonb(settings)->>'x_public')::boolean from public.get_my_feature_settings() settings),false)
    );
  end if;
  update public.profiles set registration_public_notice_pending = false where id = v_user;
  return true;
end;
$$;

grant execute on function public.get_my_registration_notice_status() to authenticated;
grant execute on function public.complete_my_registration_notice(boolean) to authenticated;
commit;
