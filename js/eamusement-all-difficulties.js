(async () => {
  'use strict';

  const RUNNING_KEY = '__gitadoraAllDifficultiesRunning';
  if (window[RUNNING_KEY]) {
    alert('全曲難易度を取得中です。');
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

  const BASE_URL = `${ORIGIN}/game/gfdm/${encodeURIComponent(slug)}/p/playdata/music_detail.html`;
  const songs = [];
  const titleSet = new Set();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function detectCategories() {
    const selectors = [
      'select[name="cat"] option',
      '#cat option',
      'select.music_category option'
    ];
    const found = new Set();
    for (const selector of selectors) {
      for (const option of document.querySelectorAll(selector)) {
        const value = Number.parseInt(option.value, 10);
        if (Number.isInteger(value) && value >= 0) found.add(value);
      }
    }
    if (found.size) return [...found].sort((a, b) => a - b);
    return Array.from(
      { length: CONFIG.END_CAT - CONFIG.START_CAT + 1 },
      (_, i) => CONFIG.START_CAT + i
    );
  }

  function makeUrl(gtype, cat, index) {
    const url = new URL(BASE_URL);
    url.searchParams.set('gtype', gtype);
    url.searchParams.set('sid', '2');
    url.searchParams.set('index', String(index));
    url.searchParams.set('cat', String(cat));
    url.searchParams.set('page', '1');
    return url.href;
  }

  async function fetchHtml(gtype, cat, index) {
    const url = makeUrl(gtype, cat, index);
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.RETRY_COUNT; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          redirect: 'follow'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (
          response.url.includes('/gate/p/login') ||
          response.url.includes('login.html')
        ) {
          throw new Error('ログアウトされています');
        }

        return { ok: true, html: await response.text(), error: null };
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.RETRY_COUNT) {
          await sleep(CONFIG.RETRY_WAIT_MS * attempt);
        }
      }
    }

    return { ok: false, html: '', error: lastError };
  }

  function toDocument(html) {
    return new DOMParser().parseFromString(html, 'text/html');
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

  async function fetchSong(cat, index) {
    const [gfResponse, dmResponse] = await Promise.all([
      fetchHtml('gf', cat, index),
      fetchHtml('dm', cat, index)
    ]);

    if (!gfResponse.ok) {
      return { status: 'error', cat, index, error: gfResponse.error };
    }

    const gfDoc = toDocument(gfResponse.html);
    const title = getTitle(gfDoc);
    if (!title) return { status: 'empty', cat, index };

    const gf = parseGF(gfDoc);
    let drum = { BASIC: '-', ADVANCED: '-', EXTREME: '-', MASTER: '-' };
    let dmTitle = null;

    if (dmResponse.ok) {
      const dmDoc = toDocument(dmResponse.html);
      dmTitle = getTitle(dmDoc);
      drum = parseDM(dmDoc);
    }

    return {
      status: 'success',
      cat,
      index,
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
    if (titleSet.has(song.title)) return;
    titleSet.add(song.title);
    songs.push(song);
  }

  async function scanCategory(cat) {
    const startTime = performance.now();
    let index = 0;
    let count = 0;

    while (index <= CONFIG.MAX_INDEX) {
      const indexes = Array.from({ length: CONFIG.CONCURRENCY }, (_, i) => index + i);
      const results = await Promise.all(indexes.map(currentIndex => fetchSong(cat, currentIndex)));
      let categoryFinished = false;

      for (const result of results) {
        if (result.status === 'empty') {
          categoryFinished = true;
          break;
        }

        if (result.status === 'error') {
          console.warn(`CAT ${cat} INDEX ${result.index} の取得に失敗`);
          const retry = await fetchSong(cat, result.index);
          if (retry.status === 'success') {
            addSong(retry.song);
            count++;
            continue;
          }
          if (retry.status === 'empty') {
            categoryFinished = true;
            break;
          }
          console.warn(`CAT ${cat} INDEX ${result.index} は再取得にも失敗。CAT ${cat} を終了します。`);
          categoryFinished = true;
          break;
        }

        const song = result.song;
        if (song.dmTitle && song.dmTitle !== song.title) {
          console.warn(
            `GF/DM曲名不一致 CAT=${cat} INDEX=${result.index}`,
            song.title,
            '/',
            song.dmTitle
          );
        }
        addSong(song);
        count++;
      }

      if (categoryFinished) break;
      index += CONFIG.CONCURRENCY;
    }

    const seconds = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`CAT ${String(cat).padStart(2, '0')} 完了 | ${count}曲 | ${seconds}秒 | 累計 ${songs.length}曲`);
    return count;
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
    const categories = detectCategories();

    console.log(`GITADORA 全曲難易度取得開始 / ${slug}`);
    console.log(`CAT ${categories[0]}～${categories[categories.length - 1]} / ${CONFIG.CONCURRENCY}曲同時処理 / 最大${CONFIG.CONCURRENCY * 2}リクエスト並列`);

    for (const cat of categories) {
      await scanCategory(cat);
    }

    const totalSeconds = ((performance.now() - totalStart) / 1000).toFixed(1);
    console.log('================================');
    console.log(`取得完了：${songs.length}曲`);
    console.log(`所要時間：${totalSeconds}秒`);

    if (!songs.length) {
      throw new Error(`1曲も取得できませんでした。公式ページの構造が変更された可能性があります。検出バージョン: ${slug}`);
    }

    console.log('Excelファイルを生成します...');
    await sleep(50);
    downloadExcel();
    console.log('Excelファイル生成完了');
  } catch (error) {
    console.error('全曲難易度取得に失敗しました。', error);
    alert(`全曲難易度取得に失敗しました。\n${error?.message || error}`);
  } finally {
    delete window[RUNNING_KEY];
  }
})();
