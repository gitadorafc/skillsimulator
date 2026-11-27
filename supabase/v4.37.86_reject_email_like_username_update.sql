-- v4.37.86: apply the existing signup username validation to renames.
-- Existing usernames are not modified. Only changes to username are checked.
-- Requires public.reject_email_like_signup_username() from v4.36.4.
drop trigger if exists reject_email_like_username_update on public.profiles;
create trigger reject_email_like_username_update
before update of username on public.profiles
for each row
when (old.username is distinct from new.username)
execute function public.reject_email_like_signup_username();
