import { supabase, getSessionUserWithRetry } from './supabase.js?v=4_19_1';

export async function getMySongCommentHistory(songId, versionId) {
  const { data, error } = await supabase.rpc('get_my_song_comment_history', {
    p_song_id: songId,
    p_version_id: versionId
  });
  if (error) throw error;
  return data ?? [];
}

export async function getMyPrivateScoreComments() {
  let sessionUser;
  try {
    sessionUser = await getSessionUserWithRetry();
  } catch (_) {
    return new Map();
  }

  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('user_scores')
      .select('id,private_comment')
      .eq('user_id', sessionUser.id)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      // SQL未適用時でもアプリ全体を止めず、コメント機能だけ無効にする。
      console.warn('曲コメント取得失敗:', error);
      return new Map();
    }

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return new Map(rows.map(row => [row.id, row.private_comment || '']));
}

export async function savePrivateScoreComment({ scoreId = null, songId = null, requestId = null, comment = '' }) {
  const normalized = String(comment || '').trim();
  if (normalized.length > 100) {
    throw new Error('コメントは100文字以内で入力してください。');
  }

  const sessionUser = await getSessionUserWithRetry();

  let query = supabase
    .from('user_scores')
    .update({ private_comment: normalized || null })
    .eq('user_id', sessionUser.id);

  if (scoreId) {
    query = query.eq('id', scoreId);
  } else if (songId) {
    query = query.eq('song_id', songId);
  } else if (requestId) {
    query = query.eq('song_request_id', requestId);
  } else {
    throw new Error('コメント保存対象の登録データを特定できません。');
  }

  const { error } = await query;
  if (error) throw error;
}
