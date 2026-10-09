(async () => {
  'use strict';

  const RUNNING_KEY = '__gitadoraAllScoreSyncRunning';
  const ORIGIN = 'https://p.eagate.573.jp';
  const APP_ORIGIN = 'https://gitadorafc.github.io';
  const PROGRESS_ID = '__gitadoraAllScoreSyncProgress';
  const CONFIG = { CONCURRENCY: 10, RETRY_COUNT: 4, RETRY_WAIT_MS: 350, SEND_CHUNK_SIZE: 25 };
  const DIFF_MAP = { BASIC:'BSC', ADVANCED:'ADV', EXTREME:'EXT', MASTER:'MAS' };
  const DIFF_RANK = { BSC:1, ADV:2, EXT:3, MAS:4 };

  if (window[RUNNING_KEY]) {
    document.getElementById(PROGRESS_ID)?.scrollIntoView({ block:'center' });
    return;
  }

  const slug = location.pathname.match(/\/game\/gfdm\/([^/]+)\//)?.[1] || '';
  if (location.origin !== ORIGIN || !/^gitadora_/i.test(slug)) {
    alert('GITADORAの公式ページで実行してください。');
    return;
  }

  function readLaunchPayload() {
    if (!location.hash.startsWith('#gitadora-all-score-sync=')) return null;
    try {
      return JSON.parse(decodeURIComponent(location.hash.slice('#gitadora-all-score-sync='.length)));
    } catch (_) {
      return null;
    }
  }

  const launch = readLaunchPayload();
  if (!launch?.syncId || !['highest','all'].includes(launch?.mode) || launch?.slug !== slug || !window.opener) {
    alert('Skill Simulatorの管理者メニューから「全曲同期」を開き、公式サイトを開いた後にこのブックマークレットを実行してください。');
    return;
  }

  window[RUNNING_KEY] = true;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let totalSongs = 0;
  let totalRecords = 0;
  let sentRecords = 0;
  let seq = 0;
  const processedTitles = new Set();

  function ensureProgressUi() {
    let root = document.getElementById(PROGRESS_ID);
    if (root) return root;
    const style = document.createElement('style');
    style.textContent = `
      #${PROGRESS_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.62);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic",Meiryo,sans-serif;color:#f8fafc}
      #${PROGRESS_ID} .gas-card{width:min(92vw,500px);border:2px solid #3b82f6;border-radius:18px;background:#0f172a;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}
      #${PROGRESS_ID} .gas-head{padding:18px 20px 10px;font-size:21px;font-weight:800}
      #${PROGRESS_ID} .gas-body{padding:0 20px 20px}
      #${PROGRESS_ID} .gas-status{font-size:14px;line-height:1.6;color:#e2e8f0;min-height:45px}
      #${PROGRESS_ID} .gas-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0;color:#94a3b8;font-size:11px}
      #${PROGRESS_ID} .gas-meta strong{display:block;color:#f8fafc;font-size:15px;margin-top:2px}
      #${PROGRESS_ID} .gas-bar{height:12px;border-radius:999px;background:#334155;overflow:hidden}
      #${PROGRESS_ID} .gas-fill{width:0%;height:100%;background:#3b82f6;transition:width .18s ease}
      #${PROGRESS_ID} .gas-percent{text-align:right;margin-top:7px;color:#cbd5e1;font-size:13px;font-weight:700}
      #${PROGRESS_ID} .gas-note{margin-top:12px;color:#94a3b8;font-size:11px;line-height:1.5}
      #${PROGRESS_ID} .gas-error{color:#fecaca}
      #${PROGRESS_ID} .gas-done{color:#bbf7d0}
    `;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = PROGRESS_ID;
    root.innerHTML = `
      <div class="gas-card" role="status" aria-live="polite">
        <div class="gas-head">${launch.mode === 'all' ? '全曲同期（全難易度）' : '全曲同期（最高難易度）'}</div>
        <div class="gas-body">
          <div class="gas-status">準備中...</div>
          <div class="gas-meta">
            <div>カテゴリ<strong class="gas-cat">-</strong></div>
            <div>確認曲数<strong class="gas-song">0曲</strong></div>
            <div>取得件数<strong class="gas-count">0件</strong></div>
          </div>
          <div class="gas-bar"><div class="gas-fill"></div></div>
          <div class="gas-percent">0%</div>
          <div class="gas-note">公式サイトから達成率を取得し、Skill Simulatorへ順次登録しています。この画面を閉じずにお待ちください。</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  function updateProgress({ status, catText, percent, state } = {}) {
    const root = ensureProgressUi();
    const statusEl = root.querySelector('.gas-status');
    if (status != null) statusEl.textContent = status;
    statusEl.classList.toggle('gas-error', state === 'error');
    statusEl.classList.toggle('gas-done', state === 'done');
    if (catText != null) root.querySelector('.gas-cat').textContent = catText;
    root.querySelector('.gas-song').textContent = `${totalSongs}曲`;
    root.querySelector('.gas-count').textContent = `${totalRecords}件`;
    if (percent != null) {
      const value = Math.max(0, Math.min(100, Number(percent) || 0));
      root.querySelector('.gas-fill').style.width = `${value}%`;
      root.querySelector('.gas-percent').textContent = `${Math.floor(value)}%`;
    }
  }

  function toDocument(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function isOfficialErrorPage(doc) {
    const text = String(doc?.body?.innerText || '').replace(/\s+/g, ' ');
    return /エラーが発生しました|時間をおいてもう一度お試しください/.test(text);
  }
  function getTitle(doc) {
    for (const selector of ['.live_title','.music_title','.music_name','.title_name']) {
      const value = String(doc.querySelector(selector)?.textContent || '').trim();
      if (value) return value;
    }
    return null;
  }
  function getDifficulty(table, type) {
    for (const selector of [`.diff_${type} .diff_area`,`.diff_${type.toLowerCase()} .diff_area`,`[class*="diff_${type}"] .diff_area`,`[class*="diff_${type.toLowerCase()}"] .diff_area`]) {
      const value = String(table.querySelector(selector)?.textContent || '').trim();
      if (/^\d+\.\d{2}$/.test(value)) return Number(value);
    }
    return null;
  }
  function getAchievement(table) {
    for (const row of table.querySelectorAll('tr')) {
      const cells = [...row.querySelectorAll('th,td')];
      if (!cells.length) continue;
      const label = String(cells[0]?.textContent || '').replace(/\s+/g,'').trim();
      if (!label.includes('達成率')) continue;
      const valueText = cells.slice(1).map(cell => cell.textContent || '').join(' ');
      const match = valueText.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) && value >= 0 && value <= 100 ? Number(value.toFixed(2)) : null;
    }
    const text = String(table.textContent || '').replace(/\s+/g,' ');
    const fallback = text.match(/達成率\s*(\d{1,3}(?:\.\d+)?)\s*%/);
    if (!fallback) return null;
    const value = Number(fallback[1]);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? Number(value.toFixed(2)) : null;
  }

  function playedChartsGF(doc) {
    const rows = [];
    let part = null;
    for (const el of doc.querySelectorAll('.md_part_GUITAR,.md_part_BASS,table.md.music_detail')) {
      if (el.classList.contains('md_part_GUITAR')) { part = 'G'; continue; }
      if (el.classList.contains('md_part_BASS')) { part = 'B'; continue; }
      if (el.tagName !== 'TABLE' || !part) continue;
      const rate = getAchievement(el);
      if (rate == null) continue;
      for (const type of ['BASIC','ADVANCED','EXTREME','MASTER']) {
        const level = getDifficulty(el, type);
        if (level == null) continue;
        rows.push({ part:`${DIFF_MAP[type]}-${part}`, level, rate, instrument:'GF' });
      }
    }
    return rows;
  }

  function playedChartsDM(doc) {
    const rows = [];
    for (const table of doc.querySelectorAll('table.md.music_detail')) {
      const rate = getAchievement(table);
      if (rate == null) continue;
      for (const type of ['BASIC','ADVANCED','EXTREME','MASTER']) {
        const level = getDifficulty(table, type);
        if (level == null) continue;
        rows.push({ part:`${DIFF_MAP[type]}-D`, level, rate, instrument:'DM' });
      }
    }
    return rows;
  }

  function chooseHighest(rows, instrument) {
    const candidates = rows.filter(row => row.instrument === instrument);
    if (!candidates.length) return [];
    candidates.sort((a,b) =>
      b.level - a.level ||
      (DIFF_RANK[b.part.split('-')[0]] || 0) - (DIFF_RANK[a.part.split('-')[0]] || 0) ||
      a.part.localeCompare(b.part)
    );
    return [candidates[0]];
  }

  function getCategoryContext(doc = document) {
    let select = null;
    for (const selector of ['select[name="cat"]','#cat','select.music_category']) {
      select = doc.querySelector(selector);
      if (select) break;
    }
    if (!select) return null;
    const form = select.closest('form');
    const options = [...select.options].map(option => ({ value:String(option.value ?? ''), label:String(option.textContent || '').trim() }))
      .filter(option => option.value !== '' && option.label !== '' && !/曲名カテゴリ.*選択|選択.*曲名カテゴリ/.test(option.label));
    return { selectName:select.name || 'cat', formAction:form?.getAttribute('action') || location.href, formMethod:String(form?.method || 'get').toLowerCase(), form, options };
  }
  function collectFormParams(form, selectedName, selectedValue) {
    const params = new URLSearchParams();
    if (form) {
      for (const el of form.elements || []) {
        if (!el?.name || el.disabled) continue;
        const type = String(el.type || '').toLowerCase();
        if ((type === 'checkbox' || type === 'radio') && !el.checked) continue;
        if (el.name === selectedName || ['submit','button','image','file'].includes(type)) continue;
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
    const init = { method:context.formMethod === 'post' ? 'POST' : 'GET', credentials:'include', cache:'no-store', redirect:'follow' };
    if (init.method === 'POST') {
      init.headers = { 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' };
      init.body = params.toString();
    } else {
      for (const [key,value] of params) actionUrl.searchParams.set(key,value);
      fetchUrl = actionUrl.href;
    }
    const response = await fetch(fetchUrl, init);
    const doc = toDocument(await response.text());
    if (!response.ok || isOfficialErrorPage(doc)) throw new Error(`カテゴリ一覧の取得に失敗しました: ${option.label}`);
    return { doc, responseUrl:response.url || fetchUrl };
  }
  function extractDetailUrls(doc, baseUrl) {
    const seen = new Set();
    const urls = [];
    for (const anchor of doc.querySelectorAll('a[href*="music_detail.html"]')) {
      const href = anchor.getAttribute('href');
      if (!href) continue;
      const url = new URL(href, baseUrl);
      if (seen.has(url.href)) continue;
      seen.add(url.href); urls.push(url);
    }
    return urls;
  }
  function makeDmUrl(gfUrl) { const u = new URL(gfUrl.href); u.searchParams.set('gtype','dm'); return u; }
  async function fetchDoc(url) {
    let lastError = null;
    for (let attempt=1; attempt<=CONFIG.RETRY_COUNT; attempt++) {
      try {
        const response = await fetch(url.href, { credentials:'include', cache:'no-store', redirect:'follow' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (response.url.includes('/gate/p/login') || response.url.includes('login.html')) throw new Error('ログアウトされています');
        const doc = toDocument(await response.text());
        if (isOfficialErrorPage(doc)) throw new Error('公式サイトがエラーを返しました');
        return doc;
      } catch (error) {
        lastError = error;
        if (attempt < CONFIG.RETRY_COUNT) await sleep(CONFIG.RETRY_WAIT_MS * attempt);
      }
    }
    throw lastError || new Error('取得に失敗しました');
  }

  async function fetchSong(gfUrl) {
    const [gfDoc, dmDoc] = await Promise.all([
      fetchDoc(gfUrl),
      fetchDoc(makeDmUrl(gfUrl)).catch(() => null)
    ]);
    const title = getTitle(gfDoc);
    if (!title) return null;
    const allRows = [
      ...playedChartsGF(gfDoc),
      ...(dmDoc ? playedChartsDM(dmDoc) : [])
    ];
    let selected = allRows;
    if (launch.mode === 'highest') selected = [...chooseHighest(allRows,'GF'), ...chooseHighest(allRows,'DM')];
    return selected.map(row => ({ title, part:row.part, rate:row.rate, level:row.level, category:'OTHER' }));
  }

  function waitForAck(currentSeq) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Skill Simulatorからの応答がありません。')); }, 120000);
      function cleanup() { clearTimeout(timer); window.removeEventListener('message', onMessage); }
      function onMessage(event) {
        if (event.origin !== APP_ORIGIN || event.source !== window.opener) return;
        const data = event.data || {};
        if (data.type !== 'GITADORA_ALL_SCORE_SYNC_ACK' || data.syncId !== launch.syncId || data.seq !== currentSeq) return;
        cleanup();
        if (data.error) reject(new Error(data.error)); else resolve();
      }
      window.addEventListener('message', onMessage);
    });
  }
  async function sendChunk(records) {
    if (!records.length) return;
    const currentSeq = ++seq;
    window.opener.postMessage({ type:'GITADORA_ALL_SCORE_SYNC_CHUNK', syncId:launch.syncId, seq:currentSeq, slug, mode:launch.mode, records }, APP_ORIGIN);
    await waitForAck(currentSeq);
    sentRecords += records.length;
  }
  async function flushRecords(records) {
    for (let offset=0; offset<records.length; offset+=CONFIG.SEND_CHUNK_SIZE) {
      await sendChunk(records.slice(offset, offset + CONFIG.SEND_CHUNK_SIZE));
    }
  }

  try {
    ensureProgressUi();
    const context = getCategoryContext();
    if (!context?.options?.length) throw new Error('曲名カテゴリを取得できませんでした。曲別成績の一覧ページで実行してください。');
    window.opener.postMessage({ type:'GITADORA_ALL_SCORE_SYNC_START', syncId:launch.syncId, slug, mode:launch.mode }, APP_ORIGIN);

    for (let categoryIndex=0; categoryIndex<context.options.length; categoryIndex++) {
      const option = context.options[categoryIndex];
      const label = option.label || option.value;
      updateProgress({ status:`カテゴリ「${label}」の一覧を取得中...`, catText:`${categoryIndex+1} / ${context.options.length}（${label}）`, percent:(categoryIndex/context.options.length)*100 });
      const { doc, responseUrl } = await fetchCategoryDocument(context, option);
      const urls = extractDetailUrls(doc, responseUrl);
      const categoryRecords = [];

      for (let offset=0; offset<urls.length; offset+=CONFIG.CONCURRENCY) {
        const batch = urls.slice(offset, offset + CONFIG.CONCURRENCY);
        updateProgress({
          status:`「${label}」 ${offset+1}〜${Math.min(offset+batch.length, urls.length)} / ${urls.length}曲を確認中...`,
          catText:`${categoryIndex+1} / ${context.options.length}（${label}）`,
          percent:((categoryIndex + offset/Math.max(1,urls.length))/context.options.length)*100
        });
        const results = await Promise.all(batch.map(async url => {
          try { return await fetchSong(url); }
          catch (error) { console.warn('曲詳細取得失敗', url.href, error); return null; }
        }));
        for (let i=0; i<results.length; i++) {
          const records = results[i];
          if (!records) continue;
          const title = records[0]?.title || '';
          if (title && processedTitles.has(title)) continue;
          if (title) processedTitles.add(title);
          totalSongs++;
          totalRecords += records.length;
          categoryRecords.push(...records);
          updateProgress();
        }
      }
      await flushRecords(categoryRecords);
      updateProgress({ status:`「${label}」完了（${categoryRecords.length}件）`, catText:`${categoryIndex+1} / ${context.options.length}（${label}）`, percent:((categoryIndex+1)/context.options.length)*100 });
    }

    window.opener.postMessage({ type:'GITADORA_ALL_SCORE_SYNC_DONE', syncId:launch.syncId, slug, mode:launch.mode, totalSongs, totalRecords }, APP_ORIGIN);
    updateProgress({ status:`取得完了：${totalSongs}曲 / ${totalRecords}件。Skill Simulatorへの登録も完了しました。`, percent:100, state:'done' });
  } catch (error) {
    console.error(error);
    updateProgress({ status:`同期に失敗しました：${error?.message || error}`, state:'error' });
  } finally {
    window[RUNNING_KEY] = false;
  }
})();
