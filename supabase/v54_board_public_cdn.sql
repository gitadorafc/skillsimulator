-- v4.31.2: 掲示板画像のCDNキャッシュ利用を優先してuncached egressを抑える。
-- 画像パスはUUIDを含む不変パスで、アプリ側は登録後24時間の掲示板アクセス制限を維持する。
-- 注意: public bucket化により、正確な画像URLを知っている場合はStorage画像へ直接アクセス可能になる。

begin;

update storage.buckets
set public = true
where id = 'board-images';

commit;
