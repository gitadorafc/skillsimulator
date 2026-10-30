-- v4.36.4: 新規プロフィール登録時のみ、メールアドレス形式のユーザー名を拒否する。
-- 既存行の変更・ログイン・プロフィール更新には影響しない。
create or replace function public.reject_email_like_signup_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized text;
begin
  -- 全角英数字・＠・ドットをASCII表記に揃えて判定する。
  normalized := translate(
    btrim(coalesce(new.username, '')),
    '＠．。ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
    '@..ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  );
  if normalized ~* '^[^[:space:]@]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' then
    raise exception 'メールアドレス形式のユーザー名は登録できません。' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_email_like_signup_username_insert on public.profiles;
create trigger reject_email_like_signup_username_insert
before insert on public.profiles
for each row execute function public.reject_email_like_signup_username();
