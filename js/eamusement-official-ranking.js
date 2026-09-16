(() => {
  'use strict';

  const OFFICIAL_ORIGIN = 'https://p.eagate.573.jp';
  const VERSION_SLUG = 'gitadora_galaxywave_delta';
  const START_SKILL = 9700;
  const BAND_SIZE = 100;
  const MAX_ROWS = 100;
  const MAX_REQUESTS = 160;
  const WAIT_MS = 350;
  const scriptSettings = new URLSearchParams((document.currentScript?.src.split('#')[1] || ''));
  const importToken = scriptSettings.get('token');
  const supabaseEndpoint = scriptSettings.get('endpoint');
  const supabaseKey = scriptSettings.get('key');

  if (location.origin !== OFFICIAL_ORIGIN || !location.pathname.includes('/game/gfdm/')) {
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
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`検索に失敗しました (${response.status})`);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    return parseRows(doc);
  }

  async function collect(instrument) {
    const prepared = await prepareInstrument(instrument);
    const found = new Map();
    let upper = Infinity;
    let floor = START_SKILL;
    let requestCount = 0;

    while (found.size < MAX_ROWS && floor >= 0 && requestCount < MAX_REQUESTS) {
      let cursor = floor;
      let lastCursor = -1;
      while (cursor < upper && requestCount < MAX_REQUESTS) {
        const rows = await search(prepared, cursor);
        requestCount += 1;
        for (const row of rows) {
          if (row.skill >= floor && row.skill < upper) found.set(`${row.playerName}\u0000${row.skill.toFixed(2)}`, row);
        }
        if (!rows.length || rows.length < 20) break;
        const lastSkill = Math.max(...rows.map(row => row.skill));
        const nextCursor = Math.round((lastSkill + 0.01) * 100) / 100;
        if (nextCursor <= cursor || nextCursor === lastCursor) break;
        lastCursor = cursor;
        cursor = nextCursor;
        await wait(WAIT_MS);
      }
      upper = floor;
      floor = Math.max(0, floor - BAND_SIZE);
      if (floor === upper) break;
      await wait(WAIT_MS);
    }
    return [...found.values()]
      .sort((a, b) => b.skill - a.skill || a.playerName.localeCompare(b.playerName, 'ja'))
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
      alert('GF・DMの公式スキルランキング上位100名を取得します。完了までこのページを閉じないでください。');
      const rankings = {};
      for (const instrument of ['GF', 'DM']) {
        rankings[instrument] = await collect(instrument);
        if (!rankings[instrument].length) throw new Error(`${instrument}の検索結果を取得できませんでした。`);
      }
      const data = { schemaVersion: 1, versionSlug: VERSION_SLUG, capturedAt: new Date().toISOString(), rankings };
      await sendToSimulator(data);
      alert(`更新完了：GF ${rankings.GF.length}名 / DM ${rankings.DM.length}名\nスキルシミュレーターへ直接反映しました。`);
    } catch (error) {
      console.error(error);
      alert(`公式ランキングの取得に失敗しました。\n${error?.message || error}`);
    } finally {
      window.__gitadoraOfficialRankingRunning = false;
    }
  })();
})();
