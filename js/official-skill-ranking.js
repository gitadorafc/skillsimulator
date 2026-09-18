import { supabase } from './supabase.js?v=21_57';

const SCRAPER_URL = new URL('./eamusement-official-ranking.js', import.meta.url).href;
const APP_URL = new URL('../', import.meta.url).href;

export function buildOfficialRankingBookmarklet() {
  // ポップアップはクリック操作中に同期的に開く必要がある。返信は読み込み前でも失われないよう一時保持する。
  const source = `javascript:(()=>{const a=${JSON.stringify(APP_URL)},v=location.pathname.split('/')[3];if(location.origin!=='https://p.eagate.573.jp'||!v){alert('GITADORAの公式ページで実行してください。');return}if(window.__gitadoraOfficialRankingRunning||window.__rankingBridge){alert('ランキングを取得中です。');return}const n=crypto.randomUUID(),p=open(a+'#official-ranking-token='+encodeURIComponent(JSON.stringify({slug:v,nonce:n})),'_blank');if(!p){alert('ポップアップを許可してください。');return}const b=window.__rankingBridge={p,n};addEventListener('message',b.on=e=>{if(e.source===p&&e.origin===new URL(a).origin&&e.data?.type==='GITADORA_RANKING_TOKEN'&&e.data?.nonce===n)b.message=e.data});const s=document.createElement('script');s.src=${JSON.stringify(SCRAPER_URL)}+'?t='+Date.now();s.onerror=()=>{removeEventListener('message',b.on);delete window.__rankingBridge;alert('ランキング用スクリプトを読み込めませんでした。')};document.body.append(s)})()`;
  return source;
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
