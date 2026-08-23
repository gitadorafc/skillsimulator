-- GITADORA Skill Simulator 3.18.3
-- 曲名中の半角・全角スペースなどの表記ゆれを吸収する。
-- 既存マスターと一致する未処理の新規曲依頼は、マスターへ自動統合する。

begin;

create or replace function public.canonicalize_song_title_spacing(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    btrim(
      replace(
        replace(coalesce(p_title, ''), chr(160), ' '),
        chr(12288),
        ' '
      )
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

create or replace function public.normalize_song_title_for_match(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    replace(
      replace(
        public.canonicalize_song_title_spacing(p_title),
        '〜',
        '~'
      ),
      '～',
      '~'
    )
  );
$$;

revoke all on function public.canonicalize_song_title_spacing(text)
  from public, anon, authenticated;
revoke all on function public.normalize_song_title_for_match(text)
  from public, anon, authenticated;

create index if not exists songs_version_part_normalized_title_idx
  on public.songs(
    version_id,
    part,
    public.normalize_song_title_for_match(title)
  );

-- 旧1引数版が残っている環境でも、今後の取り違えを防ぐ。
drop function if exists public.sync_skill_records(jsonb);

create or replace function public.sync_skill_records(
  p_records jsonb,
  p_version_id uuid
)
returns table(
  saved_count integer,
  requested_count integer,
  skipped_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_title text;
  v_title_key text;
  v_part text;
  v_rate numeric;
  v_level numeric;
  v_song_id uuid;
  v_request_id uuid;
  v_previous_option text;
  v_previous_comment text;
  v_updated integer;
  v_saved integer := 0;
  v_requested integer := 0;
  v_skipped integer := 0;
begin
  if v_uid is null then
    raise exception 'ログインが必要です。';
  end if;

  if p_version_id is null
     or not exists (
       select 1
       from public.game_versions gv
       where gv.id = p_version_id
     )
  then
    raise exception 'GITADORAバージョンが不正です。';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception '同期データの形式が不正です。';
  end if;

  if jsonb_array_length(p_records) > 120 then
    raise exception '一度に同期できる件数は120件までです。';
  end if;

  for v_item in select value from jsonb_array_elements(p_records)
  loop
    begin
      v_title := public.canonicalize_song_title_spacing(v_item->>'title');
      v_title_key := public.normalize_song_title_for_match(v_title);
      v_part := coalesce(v_item->>'part','');
      v_rate := nullif(v_item->>'rate','')::numeric;
      v_level := nullif(v_item->>'level','')::numeric;

      if v_title = ''
         or v_part not in (
           'BSC-G','ADV-G','EXT-G','MAS-G',
           'BSC-B','ADV-B','EXT-B','MAS-B',
           'BSC-D','ADV-D','EXT-D','MAS-D'
         )
         or v_rate is null or v_rate < 0 or v_rate > 100
         or v_level is null or v_level <= 0 or v_level > 99.99
      then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_rate := trunc(v_rate, 2);
      v_level := trunc(v_level, 2);
      v_song_id := null;
      v_request_id := null;
      v_previous_option := 'NORMAL';
      v_previous_comment := null;

      select
        case
          when v_part like '%-D' then
            case
              when us.play_option = 'BASS_MIRROR' then 'BASS_MIRROR'
              else 'NORMAL'
            end
          else coalesce(nullif(us.play_option, ''), 'NORMAL')
        end,
        us.private_comment
      into v_previous_option, v_previous_comment
      from public.user_scores us
      left join public.songs previous_song
        on previous_song.id = us.song_id
      left join public.song_requests previous_request
        on previous_request.id = us.song_request_id
      join public.game_versions previous_version
        on previous_version.id =
           coalesce(previous_song.version_id, previous_request.version_id)
      join public.game_versions target_version
        on target_version.id = p_version_id
      where us.user_id = v_uid
        and public.normalize_song_title_for_match(
              coalesce(previous_song.title, previous_request.title)
            ) = v_title_key
        and coalesce(previous_song.part, previous_request.part) = v_part
        and previous_version.sort_order < target_version.sort_order
      order by previous_version.sort_order desc, us.updated_at desc
      limit 1;

      v_previous_option := coalesce(v_previous_option, 'NORMAL');
      if v_part like '%-D' then
        if v_previous_option <> 'BASS_MIRROR' then
          v_previous_option := 'NORMAL';
        end if;
      elsif v_previous_option not in ('NORMAL','RAN','SRA','RAN+','SRA+') then
        v_previous_option := 'NORMAL';
      end if;

      -- 完全一致ではなく、連続スペース・全角スペース・波ダッシュを吸収して照合する。
      select s.id, s.title
      into v_song_id, v_title
      from public.songs s
      where s.version_id = p_version_id
        and public.normalize_song_title_for_match(s.title) = v_title_key
        and s.part = v_part
      order by
        case when s.title = v_title then 0 else 1 end,
        s.id
      limit 1;

      if v_song_id is not null then
        update public.user_scores
        set
          achievement_rate = v_rate,
          fc = case
            when v_rate = 100.00 then 'EXC'
            when fc = 'EXC' then null
            else fc
          end,
          play_option = case
            when v_part like '%-D' then
              case
                when play_option = 'BASS_MIRROR' then 'BASS_MIRROR'
                else 'NORMAL'
              end
            else play_option
          end,
          updated_at = now()
        where user_id = v_uid
          and song_id = v_song_id;

        get diagnostics v_updated = row_count;

        if v_updated = 0 then
          insert into public.user_scores(
            user_id, song_id, song_request_id,
            achievement_rate, fc, play_option, private_comment
          )
          values (
            v_uid, v_song_id, null,
            v_rate,
            case when v_rate = 100.00 then 'EXC' else null end,
            v_previous_option,
            v_previous_comment
          );
        end if;

        v_saved := v_saved + 1;
      else
        select sr.id
        into v_request_id
        from public.song_requests sr
        where sr.requester_id = v_uid
          and sr.version_id = p_version_id
          and public.normalize_song_title_for_match(sr.title) = v_title_key
          and sr.part = v_part
          and sr.status = 'pending'
          and sr.request_type = 'new_song'
        order by sr.created_at desc
        limit 1;

        if v_request_id is null then
          insert into public.song_requests(
            requester_id, version_id,
            title, part, proposed_level,
            status, request_type
          )
          values (
            v_uid, p_version_id,
            public.canonicalize_song_title_spacing(v_title),
            v_part, v_level,
            'pending', 'new_song'
          )
          returning id into v_request_id;
        else
          update public.song_requests
          set
            title = public.canonicalize_song_title_spacing(v_title),
            proposed_level = v_level
          where id = v_request_id;
        end if;

        update public.user_scores
        set
          achievement_rate = v_rate,
          fc = case
            when v_rate = 100.00 then 'EXC'
            when fc = 'EXC' then null
            else fc
          end,
          play_option = case
            when v_part like '%-D' then
              case
                when play_option = 'BASS_MIRROR' then 'BASS_MIRROR'
                else 'NORMAL'
              end
            else play_option
          end,
          updated_at = now()
        where user_id = v_uid
          and song_request_id = v_request_id;

        get diagnostics v_updated = row_count;

        if v_updated = 0 then
          insert into public.user_scores(
            user_id, song_id, song_request_id,
            achievement_rate, fc, play_option, private_comment
          )
          values (
            v_uid, null, v_request_id,
            v_rate,
            case when v_rate = 100.00 then 'EXC' else null end,
            v_previous_option,
            v_previous_comment
          );
        end if;

        v_requested := v_requested + 1;
      end if;

    exception
      when others then
        v_skipped := v_skipped + 1;
    end;
  end loop;

  return query
  select v_saved, v_requested, v_skipped;
end;
$$;

revoke all on function public.sync_skill_records(jsonb,uuid)
  from public, anon;
grant execute on function public.sync_skill_records(jsonb,uuid)
  to authenticated;

-- すでに未処理になっている依頼のうち、正規化後の曲名・パートが
-- 曲マスターと一致するものをマスターへ付け替え、承認済みにする。
do $$
declare
  r record;
begin
  for r in
    select
      sr.id as request_id,
      s.id as song_id,
      s.title as canonical_title,
      s.level as canonical_level
    from public.song_requests sr
    join lateral (
      select master.id, master.title, master.level
      from public.songs master
      where master.version_id = sr.version_id
        and master.part = sr.part
        and public.normalize_song_title_for_match(master.title) =
            public.normalize_song_title_for_match(sr.title)
      order by
        case when master.title = sr.title then 0 else 1 end,
        master.id
      limit 1
    ) s on true
    where sr.status = 'pending'
      and sr.request_type = 'new_song'
  loop
    insert into public.user_scores as target(
      user_id,
      song_id,
      song_request_id,
      achievement_rate,
      fc,
      play_option,
      private_comment,
      created_at,
      updated_at
    )
    select
      us.user_id,
      r.song_id,
      null,
      us.achievement_rate,
      us.fc,
      us.play_option,
      us.private_comment,
      us.created_at,
      now()
    from public.user_scores us
    where us.song_request_id = r.request_id
    on conflict (user_id, song_id) do update
    set
      achievement_rate = excluded.achievement_rate,
      fc = excluded.fc,
      play_option = excluded.play_option,
      private_comment = coalesce(
        excluded.private_comment,
        target.private_comment
      ),
      updated_at = now();

    delete from public.user_scores us
    where us.song_request_id = r.request_id;

    update public.song_requests sr
    set
      title = r.canonical_title,
      proposed_level = r.canonical_level,
      current_song_id = r.song_id,
      status = 'approved',
      reviewed_at = now(),
      reviewed_by = null
    where sr.id = r.request_id;
  end loop;
end;
$$;

commit;
