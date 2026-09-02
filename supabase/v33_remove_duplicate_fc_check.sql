-- v33: user_scores.fcの重複CHECK制約を整理する。
-- user_scores_fc_allowedを残し、同一内容のuser_scores_fc_checkだけを削除する。

begin;

alter table public.user_scores
  drop constraint if exists user_scores_fc_check;

commit;
