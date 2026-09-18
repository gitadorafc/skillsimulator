import { supabase } from './supabase.js?v=21_57';

const SCRAPER_URL = new URL('./eamusement-official-ranking.js', import.meta.url).href;
const APP_URL = new URL('../', import.meta.url).href;

export function buildOfficialRankingBookmarklet() {
  // ポップアップだけはユーザー操作中に同期的に開く。残りは読み込んだスクリプトで処理する。
  return `javascript:(()=>{if(window.__gitadoraOfficialRankingRunning||window.__rankingPopup)return alert('ランキングを取得中です。');const p=open('about:blank','_blank');if(!p)return alert('ポップアップを許可してください。');window.__rankingPopup=p;const s=document.createElement('script');s.src=${JSON.stringify(SCRAPER_URL)}+'?t='+Date.now();s.onerror=()=>{delete window.__rankingPopup;p.close();alert('ランキング用スクリプトを読み込めませんでした。')};document.body.append(s)})()`;
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
