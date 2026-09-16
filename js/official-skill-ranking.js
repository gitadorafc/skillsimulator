import { supabase } from './supabase.js?v=21_57';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=17_0';

const SCRAPER_URL = new URL('./eamusement-official-ranking.js', import.meta.url).href;

export function buildOfficialRankingBookmarklet(token) {
  const settings = new URLSearchParams({
    token,
    endpoint: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
  }).toString();
  const source = `javascript:(()=>{const s=document.createElement('script');s.src=${JSON.stringify(SCRAPER_URL)}+'?t='+Date.now()+'#'+${JSON.stringify(settings)};document.body.appendChild(s)})()`;
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
