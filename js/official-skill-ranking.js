import { supabase } from './supabase.js?v=21_57';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=17_0';

const SCRAPER_URL = new URL('./eamusement-official-ranking.js', import.meta.url).href;
const APP_URL = new URL('../', import.meta.url).href;

export function buildOfficialRankingBookmarklet() {
  const settings = new URLSearchParams({
    endpoint: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
  }).toString();
  // ポップアップはユーザー操作中に同期的に開く。トークンは管理者のサイト画面が毎回発行する。
  const source = `javascript:(()=>{const o='https://p.eagate.573.jp',a=${JSON.stringify(APP_URL)},slug=location.pathname.match(/\\/game\\/gfdm\\/([^/]+)\\//)?.[1]||'';if(location.origin!==o||!slug){alert('GITADORAの公式ページで実行してください。');return}if(window.__gitadoraOfficialRankingRunning){alert('ランキングを取得中です。');return}const n=crypto.randomUUID(),p=window.open(a+'#official-ranking-token='+encodeURIComponent(JSON.stringify({slug,nonce:n})),'_blank');if(!p){alert('ポップアップを許可して再実行してください。');return}window.__gitadoraOfficialRankingTokenPromise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('管理者確認が時間切れになりました。'))},180000);function receive(e){if(e.origin!==new URL(a).origin||e.source!==p||e.data?.type!=='GITADORA_RANKING_TOKEN'||e.data?.nonce!==n)return;clearTimeout(timer);window.removeEventListener('message',receive);e.data.error?reject(Error(e.data.error)):resolve({token:e.data.token,operatorSkills:e.data.operatorSkills})}window.addEventListener('message',receive)});const s=document.createElement('script');s.src=${JSON.stringify(SCRAPER_URL)}+'?t='+Date.now()+'#'+${JSON.stringify(settings)};document.body.appendChild(s)})()`;
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
