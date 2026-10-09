(async () => {
  'use strict';

  const RUNNING_KEY = '__gitadoraAllDifficultiesRunning';
  if (window[RUNNING_KEY]) {
    const existing = document.getElementById('__gitadoraAllDifficultiesProgress');
    if (existing) existing.scrollIntoView({ block: 'center' });
    else alert('全曲難易度を取得中です。');
    return;
  }

  const ORIGIN = 'https://p.eagate.573.jp';
  const slugMatch = location.pathname.match(/\/game\/gfdm\/([^/]+)\//);
  const slug = slugMatch?.[1] || '';

  if (location.origin !== ORIGIN || !/^gitadora_/i.test(slug)) {
    alert('GITADORAの公式ページで実行してください。');
    return;
  }

  window[RUNNING_KEY] = true;

  const CONFIG = {
    START_CAT: 0,
    END_CAT: 36,
    CONCURRENCY: 20,
    MAX_INDEX: 2000,
    RETRY_COUNT: 4,
    RETRY_WAIT_MS: 300
  };

  const detailAnchor = document.querySelector('a[href*="music_detail.html"]');
  const DETAIL_TEMPLATE_URL = detailAnchor
    ? new URL(detailAnchor.getAttribute('href'), location.href)
    : new URL(`${ORIGIN}/game/gfdm/${encodeURIComponent(slug)}/p/music_detail.html`);
  const songs = [];
  const titleSet = new Set();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const PROGRESS_ID = '__gitadoraAllDifficultiesProgress';

  function ensureProgressUi() {
    let root = document.getElementById(PROGRESS_ID);
    if (root) return root;

    const style = document.createElement('style');
    style.id = `${PROGRESS_ID}-style`;
    style.textContent = `
      #${PROGRESS_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.62);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic",Meiryo,sans-serif;color:#f8fafc}
      #${PROGRESS_ID} .gad-card{width:min(92vw,460px);border:2px solid #3b82f6;border-radius:18px;background:#0f172a;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}
      #${PROGRESS_ID} .gad-head{padding:18px 20px 10px;font-size:21px;font-weight:800}
      #${PROGRESS_ID} .gad-body{padding:0 20px 20px}
      #${PROGRESS_ID} .gad-status{font-size:14px;line-height:1.65;color:#e2e8f0;min-height:46px}
      #${PROGRESS_ID} .gad-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;color:#94a3b8;font-size:12px}
      #${PROGRESS_ID} .gad-meta strong{display:block;color:#f8fafc;font-size:16px;margin-top:2px}
      #${PROGRESS_ID} .gad-bar{height:12px;border-radius:999px;background:#334155;overflow:hidden}
      #${PROGRESS_ID} .gad-fill{width:0%;height:100%;background:#3b82f6;transition:width .18s ease}
      #${PROGRESS_ID} .gad-percent{text-align:right;margin-top:7px;color:#cbd5e1;font-size:13px;font-weight:700}
      #${PROGRESS_ID} .gad-note{margin-top:12px;color:#94a3b8;font-size:11px;line-height:1.5}
      #${PROGRESS_ID} .gad-error{color:#fecaca}
      #${PROGRESS_ID} .gad-done{color:#bbf7d0}
    `;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = PROGRESS_ID;
    root.innerHTML = `
      <div class="gad-card" role="status" aria-live="polite">
        <div class="gad-head">全曲難易度取得</div>
        <div class="gad-body">
          <div class="gad-status">準備中...</div>
          <div class="gad-meta">
            <div>カテゴリ<strong class="gad-cat">-</strong></div>
            <div>取得曲数<strong class="gad-count">0曲</strong></div>
          </div>
          <div class="gad-bar"><div class="gad-fill"></div></div>
          <div class="gad-percent">0%</div>
          <div class="gad-note">公式サイトからGF/DMの難易度を取得しています。この画面を閉じずにお待ちください。</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  function updateProgress({ status, catText, count, percent, state } = {}) {
    const root = ensureProgressUi();
    const statusEl = root.querySelector('.gad-status');
    if (status != null) statusEl.textContent = status;
    statusEl.classList.toggle('gad-error', state === 'error');
    statusEl.classList.toggle('gad-done', state === 'done');
    if (catText != null) root.querySelector('.gad-cat').textContent = catText;
    if (count != null) root.querySelector('.gad-count').textContent = `${count}曲`;
    if (percent != null) {
      const value = Math.max(0, Math.min(100, Number(percent) || 0));
      root.querySelector('.gad-fill').style.width = `${value}%`;
      root.querySelector('.gad-percent').textContent = `${Math.floor(value)}%`;
    }
    return root;
  }

  function toDocument(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function isOfficialErrorPage(doc) {
    const text = String(doc?.body?.innerText || '').replace(/\s+/g, ' ');
    return /エラーが発生しました|時間をおいてもう一度お試しください/.test(text);
  }

  function getTitle(doc) {
    const selectors = [
      '.live_title',
      '.music_title',
      '.music_name',
      '.title_name'
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const title = String(el?.textContent || '').trim();
      if (title) return title;
    }
    return null;
  }

  function getDifficulty(table, type) {
    const selectors = [
      `.diff_${type} .diff_area`,
      `.diff_${type.toLowerCase()} .diff_area`,
      `[class*="diff_${type}"] .diff_area`,
      `[class*="diff_${type.toLowerCase()}"] .diff_area`
    ];

    for (const selector of selectors) {
      const el = table.querySelector(selector);
      const value = String(el?.textContent || '').trim();
      if (/^\d+\.\d{2}$/.test(value)) return value;
    }
    return '-';
  }

  function parseGF(doc) {
    const guitar = { BASIC: '-', ADVANCED: '-', EXTREME: '-', MASTER: '-' };
    const bass = { BASIC: '-', ADVANCED: '-', EXTREME: '-', MASTER: '-' };
    let currentPart = null;

    const elements = doc.querySelectorAll(`
      .md_part_GUITAR,
      .md_part_BASS,
      table.md.music_detail
    `);

    for (const el of elements) {
      if (el.classList.contains('md_part_GUITAR')) {
        currentPart = 'GUITAR';
        continue;
      }
      if (el.classList.contains('md_part_BASS')) {
        currentPart = 'BASS';
        continue;
      }
      if (el.tagName !== 'TABLE' || !currentPart) continue;

      for (const type of ['BASIC', 'ADVANCED', 'EXTREME', 'MASTER']) {
        const value = getDifficulty(el, type);
        if (value === '-') continue;
        (currentPart === 'GUITAR' ? guitar : bass)[type] = value;
      }
    }

    return { guitar, bass };
  }

  function parseDM(doc) {
    const drum = { BASIC: '-', ADVANCED: '-', EXTREME: '-', MASTER: '-' };
    const tables = doc.querySelectorAll('table.md.music_detail');

    for (const table of tables) {
      for (const type of ['BASIC', 'ADVANCED', 'EXTREME', 'MASTER']) {
        const value = getDifficulty(table, type);
        if (value !== '-') drum[type] = value;
      }
    }
    return drum;
  }

  function getCategoryContext(doc = document) {
    const selectors = [
      'select[name="cat"]',
      '#cat',
      'select.music_category'
    ];

    let select = null;
    for (const selector of selectors) {
      select = doc.querySelector(selector);
      if (select) break;
    }
    if (!select) return null;

    const form = select.closest('form');
    const options = [...select.options]
      .map(option => ({
        value: String(option.value ?? ''),
        label: String(option.textContent || '').trim()
      }))
      .filter(option =>
        option.value !== '' &&
        option.label !== '' &&
        !/曲名カテゴリ.*選択|選択.*曲名カテゴリ/.test(option.label)
      );

    return {
      selectName: select.name || 'cat',
      formAction: form?.getAttribute('action') || location.href,
      formMethod: String(form?.method || 'get').toLowerCase(),
      form,
      options
    };
  }

  function collectFormParams(form, selectedName, selectedValue) {
    const params = new URLSearchParams();
    if (form) {
      for (const el of form.elements || []) {
        if (!el?.name || el.disabled) continue;
        const type = String(el.type || '').toLowerCase();
        if ((type === 'checkbox' || type === 'radio') && !el.checked) continue;
        if (el.name === selectedName) continue;
        if (type === 'submit' || type === 'button' || type === 'image' || type === 'file') continue;
        params.append(el.name, el.value ?? '');
      }
    }
    params.set(selectedName, selectedValue);
    return params;
  }

  async function fetchCategoryDocument(context, option) {
    const actionUrl = new URL(context.formAction, location.href);
    const params = collectFormParams(context.form, context.selectName, option.value);
    let fetchUrl = actionUrl.href;
    const init = {
      method: context.formMethod === 'post' ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow'
    };

    if (init.method === 'POST') {
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
      init.body = params.toString();
    } else {
      for (const [key, value] of params) actionUrl.searchParams.set(key, value);
      fetchUrl = actionUrl.href;
    }

    const response = await fetch(fetchUrl, init);
    const html = await response.text();
    const doc = toDocument(html);
    if (!response.ok || isOfficialErrorPage(doc)) {
      throw new Error(`カテゴリ一覧の取得に失敗しました: ${option.label || option.value}`);
    }
    return { doc, responseUrl: response.url || fetchUrl };
  }

  function extractDetailUrls(doc, baseUrl) {
    const seen = new Set();
    const urls = [];
    for (const anchor of doc.querySelectorAll('a[href*="music_detail.html"]')) {
      const href = anchor.getAttribute('href');
      if (!href) continue;
      const url = new URL(href, baseUrl);
      const key = url.href;
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(url);
    }
    return urls;
  }

  function makeDmUrl(gfUrl) {
    const url = new URL(gfUrl.href);
    url.searchParams.set('gtype', 'dm');
    return url;
  }

  async function fetchUrlHtml(url) {
    let lastError = null;
    for (let attempt = 1; attempt <= CONFIG.RETRY_COUNT; attempt++) {
      try {
        const response = await fetch(url.href, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          redirect: 'follow'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (response.url.includes('/gate/p/login') || response.url.includes('login.html')) {
          throw new Error('ログアウトされています');
        }
        const html = await response.text();
        const doc = toDocument(html);
        if (isOfficialErrorPage(doc)) {
          throw new Error(`公式サイトがエラーを返しました: ${url.href}`);
        }
        return { ok: true, doc, error: null };
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.RETRY_COUNT) await sleep(CONFIG.RETRY_WAIT_MS * attempt);
      }
    }
    return { ok: false, doc: null, error: lastError };
  }

  async function fetchSongByUrl(gfUrl) {
    const dmUrl = makeDmUrl(gfUrl);
    const [gfResponse, dmResponse] = await Promise.all([
      fetchUrlHtml(gfUrl),
      fetchUrlHtml(dmUrl)
    ]);

    if (!gfResponse.ok) {
      return { status: 'error', url: gfUrl.href, error: gfResponse.error };
    }

    const title = getTitle(gfResponse.doc);
    if (!title) return { status: 'empty', url: gfUrl.href };

    const gf = parseGF(gfResponse.doc);
    let drum = { BASIC: '-', ADVANCED: '-', EXTREME: '-', MASTER: '-' };
    let dmTitle = null;
    if (dmResponse.ok) {
      dmTitle = getTitle(dmResponse.doc);
      drum = parseDM(dmResponse.doc);
    }

    return {
      status: 'success',
      song: {
        title: String(title),
        guitar: gf.guitar,
        bass: gf.bass,
        drum,
        dmTitle
      }
    };
  }

  function addSong(song) {
    if (titleSet.has(song.title)) return false;
    titleSet.add(song.title);
    songs.push(song);
    return true;
  }

  async function scanCategory(context, option, categoryIndex, categoryTotal) {
    const startTime = performance.now();
    const label = option.label || option.value;

    updateProgress({
      status: `カテゴリ「${label}」の一覧を取得中...`,
      catText: `${categoryIndex + 1} / ${categoryTotal}（${label}）`,
      count: songs.length,
      percent: (categoryIndex / categoryTotal) * 100
    });

    const { doc, responseUrl } = await fetchCategoryDocument(context, option);
    const detailUrls = extractDetailUrls(doc, responseUrl);
    if (!detailUrls.length) {
      console.warn(`カテゴリ「${label}」で曲詳細リンクが見つかりませんでした。`);
      updateProgress({
        status: `カテゴリ「${label}」：0曲`,
        catText: `${categoryIndex + 1} / ${categoryTotal}（${label}）`,
        count: songs.length,
        percent: ((categoryIndex + 1) / categoryTotal) * 100
      });
      return 0;
    }

    let added = 0;
    for (let offset = 0; offset < detailUrls.length; offset += CONFIG.CONCURRENCY) {
      const batch = detailUrls.slice(offset, offset + CONFIG.CONCURRENCY);
      updateProgress({
        status: `「${label}」 ${Math.min(offset + 1, detailUrls.length)}〜${Math.min(offset + batch.length, detailUrls.length)} / ${detailUrls.length}曲を取得中...`,
        catText: `${categoryIndex + 1} / ${categoryTotal}（${label}）`,
        count: songs.length,
        percent: ((categoryIndex + (offset / Math.max(1, detailUrls.length))) / categoryTotal) * 100
      });

      const results = await Promise.all(batch.map(fetchSongByUrl));
      for (const result of results) {
        if (result.status === 'error') {
          console.warn('曲詳細の取得に失敗:', result.url, result.error);
          continue;
        }
        if (result.status !== 'success') continue;
        const song = result.song;
        if (song.dmTitle && song.dmTitle !== song.title) {
          console.warn('GF/DM曲名不一致', song.title, '/', song.dmTitle);
        }
        if (addSong(song)) added++;
      }
    }

    const seconds = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`カテゴリ ${label} 完了 | 一覧 ${detailUrls.length}曲 | 新規 ${added}曲 | ${seconds}秒 | 累計 ${songs.length}曲`);
    updateProgress({
      status: `「${label}」完了（${added}曲追加）`,
      catText: `${categoryIndex + 1} / ${categoryTotal}（${label}）`,
      count: songs.length,
      percent: ((categoryIndex + 1) / categoryTotal) * 100
    });
    return added;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function diffCell(value) {
    if (!value || value === '-') return '<td class="none">-</td>';
    return `<td class="diff">${escapeHtml(value)}</td>`;
  }

  function outputLabel() {
    const pageText = `${document.title} ${document.body?.innerText?.slice(0, 1000) || ''}`;
    if (/DELTA/i.test(pageText) || /delta/i.test(slug)) return 'GALAXY_WAVE_DELTA';
    if (/GALAXY\s*WAVE/i.test(pageText) || /galaxywave/i.test(slug)) return 'GALAXY_WAVE';
    return slug.replace(/^gitadora_/i, '').toUpperCase() || 'GITADORA';
  }

  function downloadExcel() {
    const parts = [];
    parts.push(`
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<style>
table { border-collapse:collapse; font-family:"Yu Gothic","Meiryo",sans-serif; font-size:11pt; }
th,td { border:1px solid #bfbfbf; padding:4px 6px; }
th { font-weight:normal; text-align:left; }
.song-title { mso-number-format:"\\@"; white-space:nowrap; min-width:260px; }
.diff { mso-number-format:"0.00"; text-align:right; min-width:70px; }
.none { mso-number-format:"\\@"; text-align:center; }
</style>
</head><body><table><thead><tr>
<th>曲名</th>
<th>BSC-G</th><th>ADV-G</th><th>EXT-G</th><th>MAS-G</th>
<th>BSC-B</th><th>ADV-B</th><th>EXT-B</th><th>MAS-B</th>
<th>BSC-D</th><th>ADV-D</th><th>EXT-D</th><th>MAS-D</th>
</tr></thead><tbody>`);

    for (const song of songs) {
      parts.push(
        '<tr>',
        `<td class="song-title">${escapeHtml(song.title)}</td>`,
        diffCell(song.guitar.BASIC),
        diffCell(song.guitar.ADVANCED),
        diffCell(song.guitar.EXTREME),
        diffCell(song.guitar.MASTER),
        diffCell(song.bass.BASIC),
        diffCell(song.bass.ADVANCED),
        diffCell(song.bass.EXTREME),
        diffCell(song.bass.MASTER),
        diffCell(song.drum.BASIC),
        diffCell(song.drum.ADVANCED),
        diffCell(song.drum.EXTREME),
        diffCell(song.drum.MASTER),
        '</tr>'
      );
    }

    parts.push('</tbody></table></body></html>');
    const blob = new Blob(['\uFEFF', parts.join('')], {
      type: 'application/vnd.ms-excel;charset=utf-8'
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `GITADORA_${outputLabel()}_曲難易度一覧.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  }

  try {
    console.clear();
    const totalStart = performance.now();
    const categoryContext = getCategoryContext(document);
    if (!categoryContext || !categoryContext.options.length) {
      throw new Error('曲名カテゴリの選択欄を検出できませんでした。曲別成績の一覧ページで実行してください。');
    }
    const categories = categoryContext.options;

    ensureProgressUi();
    updateProgress({ status: '取得を開始します...', catText: `0 / ${categories.length}`, count: 0, percent: 0 });

    console.log(`GITADORA 全曲難易度取得開始 / ${slug}`);
    console.log(`カテゴリ数: ${categories.length} / ${CONFIG.CONCURRENCY}曲同時処理`);

    for (let i = 0; i < categories.length; i++) {
      await scanCategory(categoryContext, categories[i], i, categories.length);
    }

    const totalSeconds = ((performance.now() - totalStart) / 1000).toFixed(1);
    console.log('================================');
    console.log(`取得完了：${songs.length}曲`);
    console.log(`所要時間：${totalSeconds}秒`);

    if (!songs.length) {
      throw new Error(`1曲も取得できませんでした。公式ページの構造が変更された可能性があります。検出バージョン: ${slug}`);
    }

    updateProgress({ status: 'Excelファイルを生成しています...', count: songs.length, percent: 100 });
    console.log('Excelファイルを生成します...');
    await sleep(50);
    downloadExcel();
    console.log('Excelファイル生成完了');
    updateProgress({ status: `取得完了：${songs.length}曲 / Excelをダウンロードしました。`, count: songs.length, percent: 100, state: 'done' });
    await sleep(1800);
  } catch (error) {
    console.error('全曲難易度取得に失敗しました。', error);
    updateProgress({ status: `取得に失敗しました：${error?.message || error}`, count: songs.length, state: 'error' });
    await sleep(3500);
  } finally {
    document.getElementById(PROGRESS_ID)?.remove();
    document.getElementById(`${PROGRESS_ID}-style`)?.remove();
    delete window[RUNNING_KEY];
  }
})();
