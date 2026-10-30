// admin only: isolated presentation of the registered records. No score mutations here.
import { formatLevel, formatRate, formatSkill } from './scores.js?v=4_19_1';
import { getSongSkillRank, getPartColorClass, getOptionBadgeMarkup } from './card-renderer.js?v=4_14_34';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const jacketByTitle = new Map();
let jacketsLoaded = false;
let jacketsPending = null;
const normalizeTitle = value => String(value || '').normalize('NFKC').trim().toLowerCase();

export async function loadAdminRegisteredJackets(supabase) {
  if (jacketsLoaded) return;
  if (jacketsPending) return jacketsPending;
  jacketsPending = (async () => {
    try {
      // Limit batch size and paginate; RLS can deny this for some deployments.
      for (let offset = 0; offset < 10000; offset += 500) {
        const { data, error } = await supabase.from('song_jackets')
          .select('title,image_url,storage_path').range(offset, offset + 499);
        if (error) throw error;
        for (const row of data || []) {
          const path = row.storage_path;
          const url = path ? supabase.storage.from('song-jackets').getPublicUrl(path).data.publicUrl : row.image_url;
          if (url && /^https:\/\//i.test(url)) jacketByTitle.set(normalizeTitle(row.title), url);
        }
        if (!data || data.length < 500) break;
      }
      jacketsLoaded = true;
    } catch (error) {
      // Jacket lookup is supplementary: score lists must remain usable.
      console.warn('admin UI: jacket lookup unavailable', error);
    } finally { jacketsPending = null; }
  })();
  return jacketsPending;
}

function fcIcon(record) {
  const type = Number(record.achievement_rate) === 100 ? 'EXC' : String(record.fc || '').toUpperCase();
  if (type !== 'FC' && type !== 'EXC') return '<span class="ar-fc-empty">—</span>';
  // The custom medal artwork is a later replacement; avoid pretending this is the final bear icon.
  return `<span class="ar-medal ${type === 'EXC' ? 'ar-exc' : 'ar-fc'}" title="${type}" aria-label="${type}">◉</span>`;
}
function recordCard(record, index) {
  const title = esc(record.title);
  const img = jacketByTitle.get(normalizeTitle(record.title));
  const artwork = img ? `<img loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(img)}">` : '<span class="ar-jacket-missing" aria-hidden="true">♫</span>';
  const skillRank = getSongSkillRank(Number(record.skill));
  const option = getOptionBadgeMarkup(record.play_option) || '<span class="ar-normal">NORMAL</span>';
  return `<article class="ar-record skill-row-${skillRank}" data-score-id="${esc(record.score_id)}">
    <div class="ar-no">${String(index + 1).padStart(3,'0')}</div>
    <div class="ar-art">${artwork}</div>
    <div class="ar-title"><span class="ar-song-name" title="${title}">${title}</span>${record.is_hot ? '<span class="ar-hot">HOT</span>' : ''}</div>
    <div class="ar-part"><span class="p-badge ${getPartColorClass(record.part)}">${esc(record.part)}</span></div>
    <div class="ar-level">${formatLevel(record.level)}</div>
    <div class="ar-rate">${formatRate(record.achievement_rate)}%</div>
    <div class="ar-skill skill-box-${skillRank}">${formatSkill(record.skill)}</div>
    <div class="ar-option">${option}</div>
    <div class="ar-fc-cell">${fcIcon(record)}</div>
    <div class="ar-edit"><button type="button" data-edit="${esc(record.score_id)}" aria-label="${title} を編集" title="編集">✎</button></div>
  </article>`;
}

export function renderAdminRegisteredRecords(rows) {
  if (!rows.length) return '';
  const header = `<div class="ar-table-head" aria-hidden="true"><span>No.</span><span>ジャケット</span><span>曲名</span><span>パート</span><span>Lv</span><span>達成率</span><span>スキル</span><span>オプション</span><span>FC/EXC</span><span>編集</span></div>`;
  return `<div class="ar-register-view">${header}<div class="ar-record-grid">${rows.map(recordCard).join('')}</div></div>`;
}
