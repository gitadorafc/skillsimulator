// admin only: isolated presentation of the registered records. No score mutations here.
import { formatLevel, formatRate, formatSkill } from './scores.js?v=4_19_1';
import { getSongSkillRank, getPartColorClass, getOptionBadgeMarkup } from './card-renderer.js?v=4_14_34';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const jacketByTitle = new Map();
let jacketsLoaded = false;
let jacketsPending = null;
// Preserve case: distinct songs such as Fireball / FIREBALL must not share jackets.
const normalizeTitle = value => String(value || '').normalize('NFKC').trim();

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

// A broken remote jacket must not render the browser's broken-image icon.
if (typeof document !== 'undefined') document.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.closest('#viewAllManage .ar-art')) return;
  img.replaceWith(Object.assign(document.createElement('span'), {className:'ar-jacket-missing', textContent:'♫'}));
}, true);

function bearMedal(type) {
  const cls = type === 'EXC' ? 'ar-exc' : 'ar-fc';
  return `<svg class="ar-bear-medal ${cls}" viewBox="0 0 52 52" role="img" aria-label="${type}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="ar-bear-${cls}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${type === 'EXC' ? '#fff6b7' : '#ffffff'}"/><stop offset=".45" stop-color="${type === 'EXC' ? '#efaa21' : '#bcc9df'}"/><stop offset="1" stop-color="${type === 'EXC' ? '#9b5503' : '#52647e'}"/></linearGradient></defs>
    <circle cx="11" cy="11" r="8" fill="url(#ar-bear-${cls})" stroke="${type === 'EXC' ? '#fbe38c' : '#d8e0ec'}" stroke-width="2"/>
    <circle cx="41" cy="11" r="8" fill="url(#ar-bear-${cls})" stroke="${type === 'EXC' ? '#fbe38c' : '#d8e0ec'}" stroke-width="2"/>
    <circle cx="26" cy="27" r="21" fill="url(#ar-bear-${cls})" stroke="${type === 'EXC' ? '#ffe69d' : '#eef4fc'}" stroke-width="2.5"/>
    <circle cx="26" cy="27" r="15" fill="none" stroke="${type === 'EXC' ? '#a9690b' : '#6a7a95'}" stroke-width="2" opacity=".85"/>
    <path d="M17 17 Q24 13 31 15" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}
function fcIcon(record) {
  const type = String(record.fc || '').toUpperCase();
  if (type !== 'FC' && type !== 'EXC') return '<span class="ar-fc-empty">—</span>';
  return bearMedal(type);
}
function recordCard(record, index) {
  const title = esc(record.title);
  const compareAttributes = record.song_id
    ? ` data-compare-song="${esc(record.song_id)}" data-compare-title="${title}" data-compare-part="${esc(record.part)}"`
    : '';
  const pendingBadge = record.pending_master ? '<span class="ar-pending">申請中</span>' : '';
  const img = jacketByTitle.get(normalizeTitle(record.title));
  const artwork = img ? `<img loading="lazy" alt="" src="${esc(img)}">` : '<span class="ar-jacket-missing" aria-hidden="true">♫</span>';
  const skillRank = getSongSkillRank(Number(record.skill));
  const option = getOptionBadgeMarkup(record.play_option) || '<span class="ar-normal">NORMAL</span>';
  return `<article class="ar-record skill-row-${skillRank}" data-score-id="${esc(record.score_id)}"${compareAttributes}>
    <div class="ar-no">${String(index + 1).padStart(3,'0')}</div>
    <div class="ar-art">${artwork}</div>
    <div class="ar-title"><span class="ar-song-name" title="${title}">${title}</span>${pendingBadge}${record.is_hot ? '<span class="ar-hot">HOT</span>' : ''}</div>
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
