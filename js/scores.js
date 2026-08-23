import { supabase } from './supabase.js';

export function calcSkill(level, achievementRate) {
  const value = Number(level) * 20 * Number(achievementRate) / 100;
  return Math.floor((value + Number.EPSILON) * 100) / 100;
}

export const formatLevel = value => Number(value).toFixed(2);
export const formatRate = value => Number(value).toFixed(2);
export const formatSkill = value => Number(value).toFixed(2);

export async function getMyScores(versionId = null) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('ログイン情報を取得できません。');
  }

  // 大量のsong_idを.in()でURLへ並べると、理論値アカウントのような
  // 数千件の登録でURL長上限を超える。結合済みVIEWをページ取得する。
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('my_score_details')
      .select('score_id,user_id,song_id,song_request_id,is_hot,title,part,level,achievement_rate,fc,play_option,skill,pending_master,request_status,created_at,updated_at,version_id')
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (versionId) query = query.eq('version_id', versionId);

    const { data, error } = await query;
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  const result = [];

  for (const row of rows) {
    const level = Number(row.level);
    const rate = Number(row.achievement_rate);

    if (!Number.isFinite(level) || !Number.isFinite(rate)) continue;

    result.push({
      score_id: row.score_id,
      user_id: row.user_id,
      song_id: row.song_id,
      song_request_id: row.song_request_id,
      is_hot: Boolean(row.is_hot),
      title: row.title ?? '',
      part: row.part ?? '',
      level,
      achievement_rate: rate,
      fc: row.fc,
      play_option: row.play_option,
      skill: Number.isFinite(Number(row.skill)) ? Number(row.skill) : calcSkill(level, rate),
      pending_master: Boolean(row.pending_master),
      request_status: row.request_status ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      version_id: row.version_id ?? null
    });
  }

  return result.sort((a, b) => Number(b.skill) - Number(a.skill));
}

export async function saveScore({
  scoreId,
  songId = null,
  requestId = null,
  achievementRate,
  fc = '',
  playOption = 'NORMAL'
}) {
  const rate = Number(achievementRate);

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('達成率は0.00〜100.00の範囲で入力してください。');
  }

  if (!songId && !requestId) {
    throw new Error('曲マスターまたは登録依頼が必要です。');
  }

  if (songId && requestId) {
    throw new Error('曲マスターと登録依頼を同時には指定できません。');
  }

  const payload = {
    song_id: songId,
    song_request_id: requestId,
    achievement_rate: Math.floor((rate + Number.EPSILON) * 100) / 100,
    fc: fc || null,
    play_option: playOption || 'NORMAL'
  };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('ログイン情報を取得できません。');
  }

  if (scoreId) {
    // 編集先の譜面がすでに登録済みの場合は、
    // 編集中レコードをそのままUPDATEすると (user_id, song_id) UNIQUE に衝突する。
    // その場合は「編集内容で既存レコードを上書き → 元レコードを削除」する。
    if (songId) {
      const { data: existingRows, error: existingError } = await supabase
        .from('user_scores')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('song_id', songId)
        .limit(2);

      if (existingError) throw existingError;

      const collision = (existingRows ?? []).find(row => row.id !== scoreId);
      if (collision?.id) {
        const { data: targetSong, error: targetSongError } = await supabase
          .from('songs')
          .select('title,part')
          .eq('id', songId)
          .single();

        if (targetSongError) throw targetSongError;

        const displayPart = targetSong?.part || '選択したパート';
        throw new Error(`この曲の${displayPart}は既に登録されています`);
      }
    }

    if (requestId) {
      const { data: existingRows, error: existingError } = await supabase
        .from('user_scores')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('song_request_id', requestId)
        .limit(2);

      if (existingError) throw existingError;

      const collision = (existingRows ?? []).find(row => row.id !== scoreId);
      if (collision?.id) {
        const { data: targetRequest, error: targetRequestError } = await supabase
          .from('song_requests')
          .select('title,part')
          .eq('id', requestId)
          .single();

        if (targetRequestError) throw targetRequestError;

        const displayPart = targetRequest?.part || '選択したパート';
        throw new Error(`この曲の${displayPart}は既に登録されています`);
      }
    }

    const { error } = await supabase
      .from('user_scores')
      .update(payload)
      .eq('id', scoreId);

    if (error) throw error;
    return;
  }

  const row = {
    user_id: userData.user.id,
    ...payload
  };

  if (songId) {
    // 新規登録時に同じ曲・同じパートがすでに登録済みなら上書きしない。
    // 既存レコードは保持し、サイト共通モーダルで明確にエラー表示する。
    const { data: existing, error: existingError } = await supabase
      .from('user_scores')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('song_id', songId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { data: targetSong, error: targetSongError } = await supabase
        .from('songs')
        .select('part')
        .eq('id', songId)
        .single();

      if (targetSongError) throw targetSongError;

      const displayPart = targetSong?.part || '選択したパート';
      throw new Error(`この曲の${displayPart}は既に登録されています`);
    }

    const { error } = await supabase
      .from('user_scores')
      .insert(row);

    if (error) throw error;
    return;
  }

  // 申請中の曲:
  // DBに (user_id, song_request_id) のUNIQUE制約が無い環境でも保存できるよう、
  // upsert(onConflict) は使わず、既存確認 → update / insert を明示的に行う。
  const { data: existingRequestScore, error: existingRequestError } = await supabase
    .from('user_scores')
    .select('id')
    .eq('user_id', userData.user.id)
    .eq('song_request_id', requestId)
    .maybeSingle();

  if (existingRequestError) throw existingRequestError;

  if (existingRequestScore?.id) {
    const { data: targetRequest, error: targetRequestError } = await supabase
      .from('song_requests')
      .select('part')
      .eq('id', requestId)
      .single();

    if (targetRequestError) throw targetRequestError;

    const displayPart = targetRequest?.part || '選択したパート';
    throw new Error(`この曲の${displayPart}は既に登録されています`);
  }

  const { error } = await supabase
    .from('user_scores')
    .insert(row);

  if (error) throw error;
}

export async function deleteScore(scoreId) {
  const { error } = await supabase
    .from('user_scores')
    .delete()
    .eq('id', scoreId);

  if (error) throw error;
}
