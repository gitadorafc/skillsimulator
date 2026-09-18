(() => {
  'use strict';

  const OFFICIAL_ORIGIN = 'https://p.eagate.573.jp';
  const VERSION_SLUG = location.pathname.match(/\/game\/gfdm\/([^/]+)\//)?.[1] || '';
  const START_SKILL = 9700;
  const BAND_SIZE = 100;
  const MAX_ROWS = 1000;
  // 公式のライバル検索では自分自身が検索結果に含まれないため、運営のスキルを補完する。
  const OPERATOR_NAME = 'FIZZ';
  const MAX_REQUESTS = 320;
  const MIN_REQUEST_INTERVAL_MS = 350;
  let nextSearchAt = 0;
  const scriptSettings = new URLSearchParams((document.currentScript?.src.split('#')[1] || ''));
  let importToken = '';
  const supabaseEndpoint = scriptSettings.get('endpoint');
  const supabaseKey = scriptSettings.get('key');

  if (location.origin !== OFFICIAL_ORIGIN || !/^gitadora_[a-z0-9_]+$/.test(VERSION_SLUG)) {
    alert('e-amusementのGITADORAページを開き、ログインしてから実行してください。');
    return;
  }
  if (window.__gitadoraOfficialRankingRunning) {
    alert('公式スキルランキングを取得中です。');
    return;
  }
  window.__gitadoraOfficialRankingRunning = true;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const baseUrl = instrument => `${OFFICIAL_ORIGIN}/game/gfdm/${VERSION_SLUG}/p/setting/rival_search.html?gtype=${instrument.toLowerCase()}&anum=1`;

  function createProgressPanel() {
    document.getElementById('gitadora-ranking-progress')?.remove();
    const panel = document.createElement('div');
    panel.id = 'gitadora-ranking-progress';
    panel.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:18px;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));padding:16px;border:2px solid #3b82f6;border-radius:12px;background:#0f172a;color:#f8fafc;box-shadow:0 12px 36px rgba(0,0,0,.55);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;box-sizing:border-box;text-align:left;';
    panel.innerHTML = '<div style="font-size:16px;font-weight:900;">公式スキルランキング更新</div><div data-progress-status style="margin-top:10px;font-size:14px;font-weight:900;">準備中...</div><div data-progress-detail style="margin-top:5px;color:#cbd5e1;font-size:12px;line-height:1.5;">このページを閉じないでください。</div><div style="height:10px;margin-top:12px;overflow:hidden;border-radius:999px;background:#334155;"><div data-progress-bar style="width:0;height:100%;border-radius:999px;background:#3b82f6;transition:width .2s ease;"></div></div><div data-progress-percent style="margin-top:5px;color:#94a3b8;font-size:11px;font-weight:800;text-align:right;">0%</div>';
    document.body.appendChild(panel);
    return panel;
  }

  const progressPanel = createProgressPanel();
  function updateProgress({ status, detail, percent }) {
    progressPanel.querySelector('[data-progress-status]').textContent = status;
    progressPanel.querySelector('[data-progress-detail]').textContent = detail;
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    progressPanel.querySelector('[data-progress-bar]').style.width = `${safePercent}%`;
    progressPanel.querySelector('[data-progress-percent]').textContent = `${Math.floor(safePercent)}%`;
  }

  function finishProgress(message, isError = false) {
    updateProgress({ status: isError ? '更新失敗' : '更新完了', detail: message, percent: isError ? 0 : 100 });
    progressPanel.style.borderColor = isError ? '#ef4444' : '#22c55e';
    progressPanel.querySelector('[data-progress-bar]').style.background = isError ? '#ef4444' : '#22c55e';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '閉じる';
    button.style.cssText = 'width:100%;height:38px;margin-top:12px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-size:13px;font-weight:900;cursor:pointer;';
    button.addEventListener('click', () => progressPanel.remove());
    progressPanel.appendChild(button);
  }

  function findSearchForm(doc) {
    const forms = [...doc.forms];
    return forms.find(form => {
      const text = cleanText(form.parentElement?.textContent || form.textContent);
      return text.includes('スキル検索') && form.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
    }) || forms.find(form => form.querySelector('input[type="text"],input[type="number"]'));
  }

  function buildRequest(form, value, pageUrl) {
    const input = form.querySelector('input[type="number"],input[type="text"],input:not([type])');
    if (!input) throw new Error('スキル検索欄を検出できませんでした。');
    input.value = Number(value).toFixed(2);
    const formData = new FormData(form);
    formData.set(input.name, input.value);
    const submitter = form.querySelector('input[type="submit"],button[type="submit"],button:not([type])');
    if (submitter?.name && !formData.has(submitter.name)) formData.append(submitter.name, submitter.value || '検索');
    const url = new URL(form.getAttribute('action') || pageUrl, pageUrl);
    const method = (form.method || 'get').toUpperCase();
    const params = new URLSearchParams();
    for (const [key, item] of formData.entries()) if (typeof item === 'string') params.append(key, item);
    if (method === 'GET') {
      for (const [key, item] of params) url.searchParams.set(key, item);
      return { url, options: { credentials: 'include' } };
    }
    return {
      url,
      options: {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString()
      }
    };
  }

  function parseRows(doc) {
    const table = [...doc.querySelectorAll('table')].find(item => {
      const text = cleanText(item.textContent);
      return text.includes('プレーヤー名') && text.includes('スキル');
    });
    if (!table) return [];
    return [...table.querySelectorAll('tr')].map(row => {
      const cells = [...row.querySelectorAll('td')];
      if (cells.length < 2) return null;
      const playerName = cleanText(cells[0].textContent);
      const match = cleanText(cells[cells.length - 1].textContent).match(/\d{1,5}(?:\.\d{1,2})?/);
      const skill = match ? Number(match[0]) : NaN;
      return playerName && Number.isFinite(skill) ? { playerName, skill } : null;
    }).filter(Boolean);
  }

  async function prepareInstrument(instrument) {
    const pageUrl = baseUrl(instrument);
    const response = await fetch(pageUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(`${instrument}の検索画面を開けませんでした (${response.status})`);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const form = findSearchForm(doc);
    if (!form) throw new Error(`${instrument}のスキル検索フォームを検出できませんでした。ログイン状態を確認してください。`);
    return { pageUrl, form };
  }

  async function search(prepared, skill) {
    const { url, options } = buildRequest(prepared.form, skill, prepared.pageUrl);
    const remaining = nextSearchAt - Date.now();
    if (remaining > 0) await wait(remaining);
    nextSearchAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`検索に失敗しました (${response.status})`);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    return parseRows(doc);
  }

  async function collect(instrument) {
    const instrumentOffset = instrument === 'DM' ? 50 : 0;
    updateProgress({ status: `${instrument}：検索画面を確認中`, detail: 'ログイン状態を確認しています。', percent: instrumentOffset });
    const prepared = await prepareInstrument(instrument);
    const found = new Map();
    let upper = Infinity;
    let floor = START_SKILL;
    let requestCount = 0;

    while (found.size < MAX_ROWS && floor >= 0 && requestCount < MAX_REQUESTS) {
      let cursor = floor;
      let lastCursor = -1;
      while (cursor < upper && requestCount < MAX_REQUESTS) {
        updateProgress({
          status: `${instrument}：ランキング取得中`,
          detail: `${Math.min(found.size, MAX_ROWS)} / ${MAX_ROWS}名　検索値 ${cursor.toFixed(2)}　通信 ${requestCount + 1}回目`,
          percent: instrumentOffset + Math.min(50, found.size / MAX_ROWS * 50)
        });
        const rows = await search(prepared, cursor);
        requestCount += 1;
        const occurrences = new Map();
        for (const row of rows) {
          if (row.skill < floor || row.skill >= upper) continue;
          const nameAndSkill = `${row.playerName}\u0000${row.skill.toFixed(2)}`;
          const occurrence = (occurrences.get(nameAndSkill) || 0) + 1;
          occurrences.set(nameAndSkill, occurrence);
          found.set(`${nameAndSkill}\u0000${occurrence}`, row);
        }
        updateProgress({
          status: `${instrument}：ランキング取得中`,
          detail: `${Math.min(found.size, MAX_ROWS)} / ${MAX_ROWS}名　検索値 ${cursor.toFixed(2)}　通信 ${requestCount}回`,
          percent: instrumentOffset + Math.min(50, found.size / MAX_ROWS * 50)
        });
        if (!rows.length || rows.length < 20) break;
        const lastSkill = Math.max(...rows.map(row => row.skill));
        const nextCursor = Math.round((lastSkill + 0.01) * 100) / 100;
        if (nextCursor <= cursor || nextCursor === lastCursor) break;
        lastCursor = cursor;
        cursor = nextCursor;
      }
      upper = floor;
      floor = Math.max(0, floor - BAND_SIZE);
      if (floor === upper) break;
    }
    if (found.size < MAX_ROWS && requestCount >= MAX_REQUESTS) {
      throw new Error(`${instrument}は通信上限に達したため保存しませんでした（${found.size}名）。`);
    }
    return [...found.values()]
      .sort((a, b) => b.skill - a.skill)
      .slice(0, MAX_ROWS);
  }

  function includeOperator(rows, instrument, operatorSkill) {
    // 1000件取得済みの場合は最下位を超えるスキルのみ追加する。
    // DMは現在圏外なので、取得した1000位の値を下回る限り追加しない。
    const withoutOperator = rows.filter(row => row.playerName !== OPERATOR_NAME);
    if (withoutOperator.length >= MAX_ROWS && operatorSkill < withoutOperator[MAX_ROWS - 1].skill) {
      return withoutOperator.slice(0, MAX_ROWS);
    }
    return [...withoutOperator, { playerName: OPERATOR_NAME, skill: operatorSkill }]
      .sort((a, b) => b.skill - a.skill)
      .slice(0, MAX_ROWS);
  }

  async function sendToSimulator(data) {
    if (!importToken || !supabaseEndpoint || !supabaseKey) {
      throw new Error('取込トークンがありません。サイトから新しい取得スクリプトをコピーしてください。');
    }
    const response = await fetch(`${supabaseEndpoint}/rest/v1/rpc/consume_official_ranking_import`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_token: importToken,
        p_rankings: Object.fromEntries(['GF', 'DM'].map(instrument => [
          instrument,
          data.rankings[instrument].map(row => ({
            player_name: row.playerName,
            skill: row.skill
          }))
        ])),
        p_captured_at: data.capturedAt
      })
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.message || `サイトへの取込に失敗しました (${response.status})`);
    }
  }

  (async () => {
    try {
      if (!window.__gitadoraOfficialRankingTokenPromise) {
        throw new Error('以前の更新スクリプトは使用できません。固定ブックマークレットをコピーし直してください。');
      }
      updateProgress({ status: '管理者確認中', detail: '開いたSkill Simulatorの画面でログイン状態を確認しています。', percent: 0 });
      const authorization = await window.__gitadoraOfficialRankingTokenPromise;
      importToken = authorization?.token;
      if (!/^[0-9a-f-]{36}$/i.test(importToken || '')) throw new Error('取込トークンを取得できませんでした。');
      const operatorSkills = authorization?.operatorSkills;
      if (!operatorSkills || !['GF', 'DM'].every(instrument =>
        Number.isFinite(operatorSkills[instrument]) && operatorSkills[instrument] >= 0
      )) throw new Error('サイトのユーザーリストからFIZZ(運営)のスキルを取得できませんでした。');
      const rankings = {};
      for (const instrument of ['GF', 'DM']) {
        const collected = await collect(instrument);
        if (!collected.length) throw new Error(`${instrument}の検索結果を取得できませんでした。`);
        rankings[instrument] = includeOperator(collected, instrument, operatorSkills[instrument]);
      }
      const data = { schemaVersion: 1, versionSlug: VERSION_SLUG, capturedAt: new Date().toISOString(), rankings };
      updateProgress({ status: 'サイトへ反映中', detail: 'GF・DMの取得結果を保存しています。', percent: 99 });
      await sendToSimulator(data);
      finishProgress(`GF ${rankings.GF.length}名 / DM ${rankings.DM.length}名をスキルシミュレーターへ直接反映しました。`);
    } catch (error) {
      console.error(error);
      finishProgress(error?.message || String(error), true);
    } finally {
      window.__gitadoraOfficialRankingRunning = false;
    }
  })();
})();
