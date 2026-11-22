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
    const direct = window.__GITADORA_OFFICIAL_SYNC_LAUNCH__;
    if (direct?.syncId) return direct;
    if (!location.hash.startsWith('#gitadora-all-score-sync=')) return null;
    try {
      return JSON.parse(decodeURIComponent(location.hash.slice('#gitadora-all-score-sync='.length)));
    } catch (_) {
      return null;
    }
  }

  const launch = readLaunchPayload();
  const targetWindow = launch?.targetWindow || window.opener;
  const instruments = Array.isArray(launch?.instruments)
    ? launch.instruments.filter(value => value === 'GF' || value === 'DM')
    : ['GF','DM'];
  if (!launch?.syncId || !['highest','all','range'].includes(launch?.mode) || launch?.slug !== slug || !targetWindow || !instruments.length) {
    alert('Skill Simulatorの「公式サイト同期」から実行してください。');
    return;
  }
  if (launch.mode === 'range') {
    const validateRange = (minValue, maxValue) => {
      const min = Number(minValue);
      const max = Number(maxValue);
      return Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && min <= max;
    };
    if (instruments.includes('GF') && !validateRange(launch.gfMinLevel, launch.gfMaxLevel)) {
      alert('GFの難易度幅の指定が正しくありません。');
      return;
    }
    if (instruments.includes('DM') && !validateRange(launch.dmMinLevel, launch.dmMaxLevel)) {
      alert('DMの難易度幅の指定が正しくありません。');
      return;
    }
  }

  window[RUNNING_KEY] = true;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let totalSongs = 0;
  let totalRecords = 0;
  let sentRecords = 0;
  let failedSongs = 0;
  let seq = 0;
  const processedTitles = new Set();
  // 管理者が起動した全曲同期だけ詳細診断を有効化する。通常ユーザーの同期は従来通り。
  let diagnosticsEnabled = launch.diagnostics === true;
  let configResolver;
  const configReceived = new Promise(resolve => { configResolver = resolve; });
  window.addEventListener('message', event => {
    if (event.origin !== APP_ORIGIN || event.source !== targetWindow) return;
    const payload = event.data || {};
    if (payload.type !== 'GITADORA_ALL_SCORE_SYNC_CONFIG' || payload.syncId !== launch.syncId) return;
    diagnosticsEnabled = payload.diagnostics === true;
    if (diagnosticsEnabled) {
      const root = document.getElementById(PROGRESS_ID);
      const actions = root?.querySelector('.gas-actions');
      if (actions && !actions.querySelector('.gas-log')) {
        const button = document.createElement('button');
        button.type = 'button';button.className = 'gas-log';button.textContent = '診断ログを保存';
        button.addEventListener('click', downloadDiagnostics);
        actions.prepend(button);
      }
      recordDiagnostic('diagnostics_confirmed', {message:'管理者画面で診断を有効化'});
    }
    configResolver();
  });
  const diagnosticEntries = [];
  const diagnosticStartedAt = new Date().toISOString();
  let categoryName = '';
  function recordDiagnostic(stage, details = {}) {
    if (!diagnosticsEnabled) return;
    diagnosticEntries.push({ at:new Date().toISOString(), stage, category:categoryName, ...details });
  }
  function diagnosticReport() {
    const summary = {};
    for (const entry of diagnosticEntries) summary[entry.stage] = (summary[entry.stage] || 0) + 1;
    return { version:'4.37.59', startedAt:diagnosticStartedAt, finishedAt:new Date().toISOString(),
      gameVersion:slug, mode:launch.mode, instruments, totalSongs, totalRecords,
      sentRecords, failedSongs, summary, entries:diagnosticEntries };
  }
  function sendDiagnosticsToApp() {
    if (!diagnosticsEnabled || targetWindow.closed) return;
    targetWindow.postMessage({type:'GITADORA_ALL_SCORE_SYNC_DIAGNOSTICS',
      syncId:launch.syncId, slug, report:diagnosticReport()},APP_ORIGIN);
  }
  function persistDiagnostics() {
    if (!diagnosticsEnabled) return;
    try { sessionStorage.setItem('__gitadoraLastAllScoreSyncReport', JSON.stringify(diagnosticReport())); }
    catch (error) { console.warn('診断ログの一時保存ができませんでした', error); }
    // 公式サイトとSkill SimulatorではsessionStorageが共有されない。
    // 管理者側にも診断ログを送信し、管理者画面で保存可能にする。
    sendDiagnosticsToApp();
  }
  function downloadDiagnostics() {
    const blob = new Blob([JSON.stringify(diagnosticReport(), null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gitadora-sync-diagnostics-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  recordDiagnostic('start', { message:'管理者詳細診断を開始' });

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
      #${PROGRESS_ID} .gas-actions{display:none;justify-content:flex-end;margin-top:14px}
      #${PROGRESS_ID} .gas-close{min-width:96px;height:36px;padding:0 18px;border:1px solid #64748b;border-radius:10px;background:#1e293b;color:#fff;font:inherit;font-weight:800;cursor:pointer}
      #${PROGRESS_ID} .gas-log{height:36px;padding:0 12px;border:1px solid #3b82f6;border-radius:10px;background:#1d4ed8;color:#fff;font:inherit;font-weight:700;cursor:pointer}
      #${PROGRESS_ID} .gas-close:active{transform:translateY(1px)}
      #${PROGRESS_ID} .gas-error{color:#fecaca}
      #${PROGRESS_ID} .gas-done{color:#bbf7d0}
    `;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = PROGRESS_ID;
    root.innerHTML = `
      <div class="gas-card" role="status" aria-live="polite">
        <div class="gas-head">${launch.mode === 'all' ? '全曲同期（全パート）' : launch.mode === 'range' ? '全曲同期（難易度幅指定）' : '全曲同期（最高難易度）'}</div>
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
          <div class="gas-actions">${diagnosticsEnabled ? '<button type="button" class="gas-log">診断ログを保存</button>' : ''}<button type="button" class="gas-close">閉じる</button></div>
        </div>
      </div>`;
    root.querySelector('.gas-close').addEventListener('click', () => root.remove());
    root.querySelector('.gas-log')?.addEventListener('click', downloadDiagnostics);
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
    const actionsEl = root.querySelector('.gas-actions');
    if (actionsEl) actionsEl.style.display = (state === 'done' || state === 'error') ? 'flex' : 'none';
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
      // 公式サイトでは達成率100.00%を「MAX」と表記する曲がある。
      if (valueText.trim().toUpperCase() === 'MAX') return 100;
      const match = valueText.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) && value >= 0 && value <= 100 ? Number(value.toFixed(2)) : null;
    }
    const text = String(table.textContent || '').replace(/\s+/g,' ');
    if (/達成率\s*MAX(?=\s|$)/i.test(text)) return 100;
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

  function getCategoryContext(doc = document, sourceUrl = location.href) {
    let select = null;
    for (const selector of ['select[name="cat"]','#cat','select.music_category']) {
      select = doc.querySelector(selector);
      if (select) break;
    }
    if (!select) return null;
    const form = select.closest('form');
    const options = [...select.options].map(option => ({ value:String(option.value ?? ''), label:String(option.textContent || '').trim() }))
      .filter(option => option.value !== '' && option.label !== '' && !/曲名カテゴリ.*選択|選択.*曲名カテゴリ/.test(option.label));
    return {
      selectName:select.name || 'cat',
      // action省略時はフォームが属する文書自身へ送信する。
      formAction:form?.getAttribute('action') || sourceUrl,
      sourceUrl,
      formMethod:String(form?.method || 'get').toLowerCase(), form, options
    };
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
  // 通信断・429・サーバー側一時エラーだけ再試行する。
  // 認証切れなどをリトライで隠さないようHTTP状態も確認する。
  async function fetchOfficialPage(url, init, label) {
    let lastError;
    for (let attempt = 1; attempt <= CONFIG.RETRY_COUNT; attempt++) {
      try {
        const response = await fetch(url, init);
        if (/\/gate\/p\/login|login\.html/i.test(response.url)) {
          throw new Error(`${label}: 公式サイトからログアウトされています。再ログインしてください。`);
        }
        if (!response.ok) {
          const error = new Error(`${label}: HTTP ${response.status}`);
          error.retryable = [408,429,500,502,503,504].includes(response.status);
          throw error;
        }
        const doc = toDocument(await response.text());
        if (isOfficialErrorPage(doc)) {
          const error = new Error(`${label}: 公式サイトが一時的なエラーを返しました`);
          error.retryable = true;
          throw error;
        }
        return { doc, responseUrl:response.url || url };
      } catch (error) {
        lastError = error;
        const transient = error.retryable === true ||
          (error.retryable !== false && /load failed|failed to fetch|networkerror|network request failed|timeout|connection/i.test(String(error.message || error)));
        if (!transient || attempt === CONFIG.RETRY_COUNT) break;
        updateProgress({ status:`${label}の通信を再試行中...（${attempt}/${CONFIG.RETRY_COUNT-1}回）` });
        await sleep(CONFIG.RETRY_WAIT_MS * attempt * 2);
      }
    }
    throw new Error(`${label}の取得に失敗しました: ${lastError?.message || lastError}`);
  }

  async function fetchCategoryDocument(context, option) {
    const actionUrl = new URL(context.formAction, context.sourceUrl);
    if (actionUrl.origin !== ORIGIN) throw new Error('カテゴリの送信先が公式サイト以外です。同期を中止しました。');
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
    try {
      return await fetchOfficialPage(fetchUrl, init, `カテゴリ「${option.label}」`);
    } catch (error) {
      // 認証情報を含み得るクエリ文字列・フォーム値は記録しない。
      if (/HTTP 404/.test(String(error?.message || ''))) {
        throw new Error(`${error.message}（送信方式: ${init.method} / 送信先: ${actionUrl.pathname}）`);
      }
      throw error;
    }
  }
  function extractDetailUrls(doc, baseUrl) {
    const seen = new Set();
    const urls = [];
    for (const anchor of doc.querySelectorAll('a[href*="music_detail.html"]')) {
      const href = anchor.getAttribute('href');
      if (!href) continue;
      const url = new URL(href, baseUrl);
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      urls.push({url, label:String(anchor.textContent || '').replace(/\s+/g, ' ').trim().slice(0,180)});
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
    const needGF = instruments.includes('GF');
    const needDM = instruments.includes('DM');
    // 片方の取得失敗を握りつぶさず、パートごとに診断する。
    async function fetchPart(part, url) {
      try { return {doc:await fetchDoc(url), status:'ok'}; }
      catch (error) {
        return {doc:null, status:'error', reason:String(error?.message || error)};
      }
    }
    const [gf, dm] = await Promise.all([
      needGF ? fetchPart('GF',gfUrl) : Promise.resolve({doc:null,status:'disabled'}),
      needDM ? fetchPart('DM',makeDmUrl(gfUrl)) : Promise.resolve({doc:null,status:'disabled'})
    ]);
    const title = getTitle(gf.doc || dm.doc);
    const gfRows = gf.doc ? playedChartsGF(gf.doc) : [];
    const dmRows = dm.doc ? playedChartsDM(dm.doc) : [];
    const allRows = [...gfRows,...dmRows];
    let selected = allRows;
    if (launch.mode === 'highest') {
      selected = [
        ...(needGF ? chooseHighest(allRows,'GF') : []),
        ...(needDM ? chooseHighest(allRows,'DM') : [])
      ];
    } else if (launch.mode === 'range') {
      const gfMin = Number(launch.gfMinLevel), gfMax = Number(launch.gfMaxLevel);
      const dmMin = Number(launch.dmMinLevel), dmMax = Number(launch.dmMaxLevel);
      selected = allRows.filter(row => {
        if (row.instrument === 'GF') return needGF && row.level >= gfMin && row.level <= gfMax;
        if (row.instrument === 'DM') return needDM && row.level >= dmMin && row.level <= dmMax;
        return false;
      });
    }
    return {title, records:title ? selected.map(row => ({title, part:row.part, rate:row.rate, level:row.level, category:'OTHER'})) : [],
      gf:{status:gf.status, reason:gf.reason || '', parsed:gfRows.length},
      dm:{status:dm.status, reason:dm.reason || '', parsed:dmRows.length}, parsed:allRows.length};
  }

  function waitForAck(currentSeq, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('応答待ちタイムアウト')); }, timeoutMs);
      function cleanup() { clearTimeout(timer); window.removeEventListener('message', onMessage); }
      function onMessage(event) {
        if (event.origin !== APP_ORIGIN || event.source !== targetWindow) return;
        const data = event.data || {};
        if (data.type !== 'GITADORA_ALL_SCORE_SYNC_ACK' || data.syncId !== launch.syncId || data.seq !== currentSeq) return;
        cleanup();
        if (data.error) reject(new Error(data.error)); else resolve(data.result || null);
      }
      window.addEventListener('message', onMessage);
    });
  }
  async function sendChunk(records) {
    if (!records.length) return;
    const currentSeq = ++seq;
    const payload = { type:'GITADORA_ALL_SCORE_SYNC_CHUNK', syncId:launch.syncId, seq:currentSeq, slug, mode:launch.mode, instruments, records };
    for (let attempt=1; attempt<=3; attempt++) {
      if (targetWindow.closed) throw new Error('Skill Simulatorの同期先タブが閉じられました。');
      // 再送でも同じsyncId/seqを送る。受信側は保存済み結果を再応答する。
      const response = waitForAck(currentSeq);
      targetWindow.postMessage(payload, APP_ORIGIN);
      try {
        const saveResult = await response;
        recordDiagnostic('save_chunk', {seq:currentSeq, sent:records.length,
          saved:saveResult?.saved ?? null, requested:saveResult?.requested ?? null,
          skipped:saveResult?.skipped ?? null,
          normalization:saveResult?.audit || null,
          songs:[...new Set(records.map(row => row.title))],
          note:'曲単位のDB保存成否はRPC応答からは判定できません'});
        sentRecords += records.length;
        return;
      } catch (error) {
        recordDiagnostic('save_retry_or_error', {seq:currentSeq, attempt, reason:String(error?.message || error)});
        if (error?.message !== '応答待ちタイムアウト') throw error;
        if (attempt === 3) throw new Error(`Skill Simulatorから保存結果の応答がありません（送信 ${currentSeq}、3回確認）。同期先タブを確認してください。`);
        updateProgress({ status:`Skill Simulatorの応答を再確認しています…（送信 ${currentSeq}、${attempt}/2回目）` });
      }
    }
  }
  async function flushRecords(records) {
    for (let offset=0; offset<records.length; offset+=CONFIG.SEND_CHUNK_SIZE) {
      await sendChunk(records.slice(offset, offset + CONFIG.SEND_CHUNK_SIZE));
    }
  }

  try {
    ensureProgressUi();
    let context = getCategoryContext();
    recordDiagnostic('category_context', {source:'current_page', categories:context?.options?.length || 0});
    if (!context?.options?.length) {
      updateProgress({ status:'曲別成績の一覧情報を取得しています…', percent:0 });
      const listUrl = new URL(`/game/gfdm/${slug}/p/playdata/music.html`, location.origin);
      const { doc, responseUrl } = await fetchOfficialPage(listUrl.href, { credentials:'include', cache:'no-store', redirect:'follow' }, '曲別成績の一覧ページ');
      context = getCategoryContext(doc, responseUrl);
      recordDiagnostic('category_context', {source:'fetched_page', categories:context?.options?.length || 0});
    }
    if (!context?.options?.length) throw new Error('曲名カテゴリを取得できませんでした。');
    targetWindow.postMessage({ type:'GITADORA_ALL_SCORE_SYNC_START', syncId:launch.syncId, slug, mode:launch.mode, instruments }, APP_ORIGIN);
    // 受信側の管理者認証結果を受けて診断を有効化。未応答でも同期は止めない。
    await Promise.race([configReceived, sleep(1500)]);
    for (let categoryIndex=0; categoryIndex<context.options.length; categoryIndex++) {
      const option = context.options[categoryIndex];
      const label = option.label || option.value;
      categoryName = label;
      recordDiagnostic('category_start', {index:categoryIndex+1, total:context.options.length});
      updateProgress({ status:`カテゴリ「${label}」の一覧を取得中...`, catText:`${categoryIndex+1} / ${context.options.length}（${label}）`, percent:(categoryIndex/context.options.length)*100 });
      const { doc, responseUrl } = await fetchCategoryDocument(context, option);
      const urls = extractDetailUrls(doc, responseUrl);
      recordDiagnostic('category_list', {detailLinks:urls.length, path:new URL(responseUrl).pathname});
      const categoryRecords = [];

      for (let offset=0; offset<urls.length; offset+=CONFIG.CONCURRENCY) {
        const batch = urls.slice(offset, offset + CONFIG.CONCURRENCY);
        updateProgress({
          status:`「${label}」 ${offset+1}〜${Math.min(offset+batch.length, urls.length)} / ${urls.length}曲を確認中...`,
          catText:`${categoryIndex+1} / ${context.options.length}（${label}）`,
          percent:((categoryIndex + offset/Math.max(1,urls.length))/context.options.length)*100
        });
        const results = await Promise.all(batch.map(async item => {
          try { return {item, data:await fetchSong(item.url)}; }
          catch (error) { return {item, error:String(error?.message || error)}; }
        }));
        for (const {item, data, error} of results) {
          const title = data?.title || item.label || '(曲名取得不可)';
          if (error) {
            failedSongs++;
            recordDiagnostic('song_error', {title, reason:error});
            console.warn('曲詳細取得失敗', title, error);
            continue;
          }
          if (!data) continue;
          if (data.gf.status === 'error') recordDiagnostic('part_error', {title, part:'GF', reason:data.gf.reason});
          if (data.dm.status === 'error') recordDiagnostic('part_error', {title, part:'DM', reason:data.dm.reason});
          if (!data.title) {
            failedSongs++;
            recordDiagnostic('title_missing', {listLabel:item.label, gf:data.gf, dm:data.dm});
            continue;
          }
          if (processedTitles.has(data.title)) {
            recordDiagnostic('duplicate_title', {title:data.title, parsed:data.parsed, selected:data.records.length});
            continue;
          }
          processedTitles.add(data.title);
          totalSongs++;
          totalRecords += data.records.length;
          if (!data.records.length) recordDiagnostic('zero_records', {title:data.title,
            gf:data.gf, dm:data.dm, mode:launch.mode, reason:data.parsed ? 'mode_filter_or_range' : 'no_achievement_parsed'});
          else recordDiagnostic('song_parsed', {title:data.title, gf:data.gf, dm:data.dm,
            records:data.records.length, parts:data.records.map(row => row.part)});
          categoryRecords.push(...data.records);
          updateProgress();
        }
      }
      await flushRecords(categoryRecords);
      recordDiagnostic('category_done', {records:categoryRecords.length, songs:urls.length});
      persistDiagnostics();
      updateProgress({ status:`「${label}」完了（${categoryRecords.length}件）`, catText:`${categoryIndex+1} / ${context.options.length}（${label}）`, percent:((categoryIndex+1)/context.options.length)*100 });
    }

    recordDiagnostic('done', {totalSongs,totalRecords,failedSongs,sentRecords});
    persistDiagnostics();
    targetWindow.postMessage({ type:'GITADORA_ALL_SCORE_SYNC_DONE', syncId:launch.syncId, slug, mode:launch.mode, totalSongs, totalRecords, failedSongs }, APP_ORIGIN);
    updateProgress({ status:`取得完了：${totalSongs}曲 / ${totalRecords}件。${failedSongs ? `曲詳細の取得失敗 ${failedSongs}曲（公式サイトの通信・ログイン状態を確認してください）。` : ''}Skill Simulatorへの登録が完了しました。`, percent:100, state:'done' });
  } catch (error) {
    recordDiagnostic('sync_error', {reason:String(error?.message || error)});
    persistDiagnostics();
    console.error(error);
    updateProgress({ status:`同期に失敗しました：${error?.message || error}`, state:'error' });
  } finally {
    persistDiagnostics();
    window[RUNNING_KEY] = false;
    window.__GITADORA_SKILL_SIMULATOR_SYNC_RUNNING__ = false;
    delete window.__GITADORA_OFFICIAL_SYNC_LAUNCH__;
  }
})();
