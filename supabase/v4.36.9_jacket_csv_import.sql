-- 1. v4.36.9_song_jackets.sql を先に実行
-- 2. Table Editorで public.song_jacket_csv_stage を開き、CSVをインポート
-- 3. このファイルの「一括反映」部分をSQL Editorで実行
create table if not exists public.song_jacket_csv_stage (
 title text,
 image_url text,
 category integer
);
alter table public.song_jacket_csv_stage enable row level security;
-- 上記CREATE TABLEだけ先に実行してからCSVを取り込んでください。

-- 一括反映（CSVインポート後に実行）
-- 公式ページの画像URLはログイン期限等で使えなくなる可能性があります。
-- 有効なURLだけを登録し、既存のアップロード画像は優先して維持します。
insert into public.song_jackets(title,image_url)
select distinct on (btrim(stage.title)) btrim(stage.title),btrim(stage.image_url)
from public.song_jacket_csv_stage stage
where exists(select 1 from public.songs s where s.title=btrim(stage.title))
  and stage.image_url ~ '^https://'
order by btrim(stage.title),stage.category
on conflict(title) do update
  set image_url=excluded.image_url,updated_at=now();

-- 曲マスターに一致しなかったCSV曲名の確認
select stage.title
from public.song_jacket_csv_stage stage
where not exists(select 1 from public.songs s where s.title=btrim(stage.title))
group by stage.title order by stage.title;
-- 再インポートする場合は先にステージングテーブルを空にしてください。
-- truncate public.song_jacket_csv_stage;
