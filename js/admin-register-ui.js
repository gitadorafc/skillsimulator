// admin only: isolated presentation of the registered records. No score mutations here.
import { formatLevel, formatRate, formatSkill } from './scores.js?v=4_19_1';
import { getSongSkillRank, getPartColorClass, getOptionBadgeMarkup } from './card-renderer.js?v=4_14_34';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const jacketByTitle = new Map();
const staticJacketTitles = new Set();

let jacketsLoaded = false;
let jacketsPending = null;
const missingJacketTitles = new Set();
// Keep case distinct (Fireball and FIREBALL are different songs); align wave-dash/spacing only.
const normalizeTitle = value => String(value || '')
  .normalize('NFKC').replace(/\u301c/g, '\uff5e')
  .replace(/[\s\u3000]+/g, ' ').trim();
const isWebUrl = url => /^https?:\/\//i.test(String(url || ''));

function jacketCandidates(supabase, row) {
  const urls = [];
  if (row.storage_path) {
    const storageUrl = supabase.storage.from('song-jackets').getPublicUrl(row.storage_path).data.publicUrl;
    if (isWebUrl(storageUrl)) urls.push(storageUrl);
  }
  if (isWebUrl(row.image_url) && !urls.includes(row.image_url)) urls.push(row.image_url);
  return urls;
}

export async function loadAdminRegisteredJackets(supabase) {
  if (jacketsLoaded) return;
  if (jacketsPending) return jacketsPending;
  jacketsPending = (async () => {
    try {
      // The Pages manifest is read first; DB records are a fallback during migration.
      // A missing manifest is normal before any migration batch is published.
      try {
        const manifestResponse = await fetch('./assets/jackets/manifest.json', {cache:'no-cache'});
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          if (manifest?.schema === 1 && manifest.titles && typeof manifest.titles === 'object') {
            for (const [title, file] of Object.entries(manifest.titles)) {
              if (!/^[a-f0-9]{24}\.webp$/.test(file)) continue;
              const key = normalizeTitle(title);
              jacketByTitle.set(key, [new URL(`./assets/jackets/${file}`, document.baseURI).href]);
              staticJacketTitles.add(key);
            }
            console.info(`[admin jackets] ${staticJacketTitles.size} Pages images mapped`);
          }
        }
      } catch (error) { console.warn('[admin jackets] Pages manifest unavailable:', error); }
      const staged = new Map();
      // Read all pages, including >1000 entries: Supabase defaults to 1000 rows per response.
      for (let offset = 0; offset < 10000; offset += 500) {
        const { data, error } = await supabase.from('song_jackets')
          .select('title,image_url,storage_path').order('title', { ascending:true })
          .range(offset, offset + 499);
        if (error) throw error;
        for (const row of data || []) {
          const key = normalizeTitle(row.title);
          if (!key) continue;
          const urls = jacketCandidates(supabase, row);
          if (!urls.length) continue;
          const prior = staged.get(key) || [];
          // Preserve first candidate per title and keep uploaded storage URLs as priority.
          staged.set(key, [...new Set([...prior, ...urls])]);
        }
        if (!data || data.length < 500) break;
      }
      for (const [key, urls] of staged) {
        if (!staticJacketTitles.has(key)) jacketByTitle.set(key, urls);
      }
      jacketsLoaded = true;
      console.info(`[admin jackets] ${jacketByTitle.size} jacket titles loaded`);
    } catch (error) {
      console.warn('[admin jackets] reading song_jackets failed', error);
      // Do not mark as loaded: retry after a transient network failure.
    } finally {
      jacketsPending = null;
    }
  })();
  return jacketsPending;
}

// Attempt the second registered image source before showing the missing-image icon.
if (typeof document !== 'undefined') document.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.closest('#viewAllManage .ar-art')) return;
  const fallback = img.getAttribute('data-jacket-fallback');
  if (fallback && fallback !== img.src && !img.dataset.jacketRetried) {
    img.dataset.jacketRetried = '1';
    img.src = fallback;
    return;
  }
  if (!img.dataset.jacketErrorLogged) {
    console.warn('[admin jackets] image request failed:', img.currentSrc || img.src);
    img.dataset.jacketErrorLogged = '1';
  }
  img.replaceWith(Object.assign(document.createElement('span'), {
    className:'ar-jacket-missing', textContent:'♫'
  }));
}, true);

let bearMedalId = 0;
function bearMedal(type) {
  const cls = type === 'EXC' ? 'ar-exc' : 'ar-fc';
  bearMedalId += 1;
  const gradientId = `ar-bear-grad-${cls}-${bearMedalId}`;
  const shineId = `ar-bear-shine-${cls}-${bearMedalId}`;
  const ringId = `ar-bear-ring-${cls}-${bearMedalId}`;
  const palette = type === 'EXC'
    ? { outer:'#7a4300', ring:'#ffe18c', dark:'#a45d08', mid:'#f1b536', light:'#fff6c5', shine:'#fffbe6' }
    : { outer:'#4f607e', ring:'#eef5ff', dark:'#7a8ca9', mid:'#b9c8de', light:'#ffffff', shine:'#ffffff' };
  return `<svg class="ar-bear-medal ${cls}" viewBox="0 0 64 64" role="img" aria-label="${type}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="${gradientId}" cx="30%" cy="25%" r="80%">
        <stop offset="0" stop-color="${palette.light}"/>
        <stop offset=".36" stop-color="${palette.mid}"/>
        <stop offset=".72" stop-color="${palette.dark}"/>
        <stop offset="1" stop-color="${palette.outer}"/>
      </radialGradient>
      <radialGradient id="${shineId}" cx="24%" cy="18%" r="50%">
        <stop offset="0" stop-color="${palette.shine}" stop-opacity=".95"/>
        <stop offset=".65" stop-color="${palette.shine}" stop-opacity=".2"/>
        <stop offset="1" stop-color="${palette.shine}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${ringId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.ring}"/>
        <stop offset=".5" stop-color="${palette.light}"/>
        <stop offset="1" stop-color="${palette.dark}"/>
      </linearGradient>
    </defs>
    <circle cx="18" cy="14" r="10" fill="url(#${gradientId})" stroke="url(#${ringId})" stroke-width="2.2"/>
    <circle cx="46" cy="14" r="10" fill="url(#${gradientId})" stroke="url(#${ringId})" stroke-width="2.2"/>
    <circle cx="32" cy="34" r="23" fill="url(#${gradientId})" stroke="url(#${ringId})" stroke-width="2.8"/>
    <circle cx="32" cy="34" r="17" fill="none" stroke="${palette.ring}" stroke-opacity=".9" stroke-width="2.4"/>
    <ellipse cx="32" cy="34" rx="19" ry="16" fill="url(#${shineId})"/>
    <path d="M22 24 C27 19, 37 19, 42 24" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="26" cy="33" r="1.7" fill="rgba(255,255,255,.6)"/>
    <circle cx="38" cy="33" r="1.7" fill="rgba(255,255,255,.6)"/>
  </svg>`;
}
function fcIcon(record) {
  const type = String(record.fc || '').toUpperCase();
  if (type !== 'FC' && type !== 'EXC') return '';
  return bearMedal(type);
}
function recordCard(record, index) {
  const title = esc(record.title);
  const compareAttributes = record.song_id
    ? ` data-compare-song="${esc(record.song_id)}" data-compare-title="${title}" data-compare-part="${esc(record.part)}"`
    : '';
  const pendingBadge = record.pending_master ? '<span class="ar-pending">申請中</span>' : '';
  const normalized = normalizeTitle(record.title);
  const urls = jacketByTitle.get(normalized) || [];
  // Useful diagnostics without exposing private score data or credentials.
  if (!urls.length && jacketsLoaded && !missingJacketTitles.has(normalized)) {
    missingJacketTitles.add(normalized);
    if (missingJacketTitles.size <= 8) console.warn('[admin jackets] no matching jacket title:', normalized);
  }
  const artwork = urls.length
    ? `<img loading="lazy" alt="" src="${esc(urls[0])}"${urls[1] ? ` data-jacket-fallback="${esc(urls[1])}"` : ''}>`
    : '<span class="ar-jacket-missing" aria-hidden="true">♫</span>';
  const skillRank = getSongSkillRank(Number(record.skill));
  const option = getOptionBadgeMarkup(record.play_option);
  return `<article class="ar-record skill-row-${skillRank}" data-score-id="${esc(record.score_id)}"${compareAttributes}>
    <div class="ar-no">${String(index + 1).padStart(3,'0')}</div>
    <div class="ar-art">${artwork}</div>
    <div class="ar-title">${record.is_hot ? '<span class="hot-tag ar-hot">HOT</span>' : ''}<span class="ar-song-name" title="${title}">${title}</span>${pendingBadge}</div>
    <div class="ar-metrics"><div class="ar-part"><span class="p-badge ${getPartColorClass(record.part)}">${esc(record.part)}</span></div>
    <div class="ar-level"><span class="ar-mini-label">Lv</span><strong>${formatLevel(record.level)}</strong></div>
    <div class="ar-rate"><span class="ar-mini-label">達成率</span><strong>${formatRate(record.achievement_rate)}%</strong></div>
    <div class="ar-skill skill-box-${skillRank}"><span class="dc-skill-value">${formatSkill(record.skill)}</span></div>
    <div class="ar-option">${option}</div>
    </div>
    <div class="ar-fc-cell">${fcIcon(record)}</div>
    <div class="ar-edit"><button type="button" data-edit="${esc(record.score_id)}" aria-label="${title} を編集" title="編集">✎</button></div>
  </article>`;
}

export function renderAdminRegisteredRecords(rows) {
  if (!rows.length) return '';
  const header = `<div class="ar-table-head" aria-hidden="true"><span>No.</span><span>ジャケット</span><span>曲名</span><span>パート</span><span>Lv</span><span>達成率</span><span>オプション</span><span>FC/EXC</span><span>スキル</span><span>編集</span></div>`;
  return `<div class="ar-register-view">${header}<div class="ar-record-grid">${rows.map(recordCard).join('')}</div></div>`;
}
