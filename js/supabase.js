
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=17_0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

// 画面復帰とトークン更新が重なった瞬間にセッションが一時的に
// 取得できないことがあるため、短い間隔で再確認する。
export async function getSessionUserWithRetry() {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data?.session?.user) return data.session.user;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 2) await wait(200 * (attempt + 1));
  }

  const error = new Error('ログイン情報を一時的に取得できません。');
  error.code = 'AUTH_SESSION_TEMPORARY_UNAVAILABLE';
  error.cause = lastError;
  throw error;
}
