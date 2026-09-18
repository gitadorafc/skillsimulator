import { supabase } from './supabase.js?v=21_57';

const SCRAPER_URL = new URL('./eamusement-official-ranking.js', import.meta.url).href;
const APP_URL = new URL('../', import.meta.url).href;

export function buildOfficialRankingBookmarklet() {
  // ポップアップはブラウザのブロックを避けるため、クリック直後に開く必要がある。
  // それ以外の管理者確認とランキング取得は外部スクリプトに任せる。
  return `javascript:(d=>{if(window.__rankingPopup||window.__gitadoraOfficialRankingRunning)return;var p=open('about:blank');if(!p)return alert('ポップアップを許可してください。');window.__rankingPopup=p;var s=d.createElement('script');s.src=${JSON.stringify(SCRAPER_URL)}+'?t='+Date.now();s.onerror=()=>{p.close();delete window.__rankingPopup;alert('読み込みに失敗しました。')};d.head.append(s)})(document)`;
}

export async function createOfficialRankingImportToken(versionId) {
  const { data, error } = await supabase.rpc('create_official_ranking_import_token', {
    p_version_id: versionId
  });
  if (error) throw error;
  return String(data || '');
}

export async function getOfficialSkillRanking(versionId, instrument) {
  const { data, error } = await supabase.rpc('get_official_skill_ranking', {
    p_version_id: versionId,
    p_instrument: instrument
  });
  if (error) throw error;
  return data || [];
}
