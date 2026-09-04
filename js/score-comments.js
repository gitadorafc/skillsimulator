import { supabase } from './supabase.js?v=21_57';

export async function getMyPrivateScoreComments() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new Map();

  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('user_scores')
      .select('id,private_comment')
      .eq('user_id', userData.user.id)
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

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('ログイン情報を取得できません。');

  let query = supabase
    .from('user_scores')
    .update({ private_comment: normalized || null })
    .eq('user_id', userData.user.id);

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

