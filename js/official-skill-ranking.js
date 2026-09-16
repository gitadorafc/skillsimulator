import { supabase } from './supabase.js?v=21_57';

const SCRAPER_URL = new URL('./eamusement-official-ranking.js', import.meta.url).href;

export function buildOfficialRankingBookmarklet() {
  const source = `javascript:(()=>{const s=document.createElement('script');s.src=${JSON.stringify(SCRAPER_URL)}+'?t='+Date.now();document.body.appendChild(s)})()`;
  return source;
}

export async function getOfficialSkillRanking(versionId, instrument) {
  const { data, error } = await supabase.rpc('get_official_skill_ranking', {
    p_version_id: versionId,
    p_instrument: instrument
  });
  if (error) throw error;
  return data || [];
}

export async function replaceOfficialSkillRankings(versionId, rankings, capturedAt) {
  const { data, error } = await supabase.rpc('replace_official_skill_rankings', {
    p_version_id: versionId,
    p_rankings: Object.fromEntries(['GF', 'DM'].map(instrument => [
      instrument,
      rankings[instrument].map(row => ({
        player_name: row.playerName,
        skill: Number(row.skill)
      }))
    ])),
    p_captured_at: capturedAt || new Date().toISOString()
  });
  if (error) throw error;
  return data;
}

export function validateOfficialRankingFile(value) {
  if (!value || value.schemaVersion !== 1 || !value.rankings) {
    throw new Error('公式ランキング用のJSONではありません。');
  }
  const normalized = {};
  for (const instrument of ['GF', 'DM']) {
    const source = value.rankings[instrument];
    if (!Array.isArray(source) || !source.length) {
      throw new Error(`${instrument}のランキングがありません。`);
    }
    normalized[instrument] = source.slice(0, 100).map((row, index) => {
      const playerName = String(row?.playerName || '').trim();
      const skill = Number(row?.skill);
      if (!playerName || !Number.isFinite(skill) || skill < 0 || skill > 10000) {
        throw new Error(`${instrument}の${index + 1}件目が不正です。`);
      }
      return { playerName, skill };
    });
  }
  return {
    versionSlug: String(value.versionSlug || ''),
    capturedAt: value.capturedAt || new Date().toISOString(),
    rankings: normalized
  };
}
