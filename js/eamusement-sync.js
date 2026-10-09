(() => {
  'use strict';

  const RUNNING_KEY = '__GITADORA_SKILL_SIMULATOR_SYNC_RUNNING__';
  const PICKER_ID = '__gitadoraOfficialSyncPicker';
  const VERSION_SLUG = location.pathname.match(/\/game\/gfdm\/([^/]+)\//)?.[1] || '';
  const RETURN_URL = 'https://gitadorafc.github.io/skillsimulator/';
  const APP_ORIGIN = 'https://gitadorafc.github.io';
  const EAMUSEMENT_ORIGIN = 'https://p.eagate.573.jp';

  if (window[RUNNING_KEY]) {
    document.getElementById(PICKER_ID)?.scrollIntoView({ block:'center' });
    return;
  }

  try {
    if (location.origin !== EAMUSEMENT_ORIGIN || !/^gitadora_[a-z0-9_]+$/i.test(VERSION_SLUG)) {
      throw new Error('GITADORAのe-amusementページで実行してください。');
    }
    window[RUNNING_KEY] = true;
  } catch (error) {
    window[RUNNING_KEY] = false;
    alert(error?.message || String(error));
    return;
  }

  const PART_MAP = { GUITAR:'G', BASS:'B', DRUM:'D', DRUMS:'D' };
  const DIFF_MAP = { BASIC:'BSC', ADVANCED:'ADV', EXTREME:'EXT', MASTER:'MAS' };

  function cleanupPicker() {
    document.getElementById(PICKER_ID)?.remove();
    document.getElementById(`${PICKER_ID}-style`)?.remove();
  }

  function showPicker() {
    const style = document.createElement('style');
    style.id = `${PICKER_ID}-style`;
    style.textContent = `
      #${PICKER_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.55);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic",Meiryo,sans-serif;color:#0f172a}
      #${PICKER_ID} .gos-card{width:min(92vw,470px);background:#fff;border:1px solid #94a3b8;border-radius:14px;box-shadow:0 20px 70px rgba(0,0,0,.35);overflow:hidden}
      #${PICKER_ID} .gos-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #cbd5e1;font-size:18px}
      #${PICKER_ID} .gos-close{width:34px;height:34px;border:0;background:transparent;font-size:22px;cursor:pointer}
      #${PICKER_ID} .gos-body{padding:16px}
      #${PICKER_ID} label.gos-option{display:flex;align-items:center;gap:8px;min-height:36px;font-size:16px;cursor:pointer}
      #${PICKER_ID} input[type="radio"]{width:18px;height:18px;margin:0}
      #${PICKER_ID} .gos-range{display:flex;align-items:center;gap:10px;margin:0 0 8px 28px}
      #${PICKER_ID} .gos-range input{width:90px;height:36px;box-sizing:border-box;border:1px solid #94a3b8;border-radius:6px;padding:0 8px;font-size:16px;text-align:center}
      #${PICKER_ID} .gos-actions{display:flex;justify-content:flex-end;margin-top:16px}
      #${PICKER_ID} .gos-submit{height:38px;padding:0 20px;border:1px solid #334155;border-radius:7px;background:#fff;color:#0f172a;font-weight:700;font-size:15px;cursor:pointer}
      #${PICKER_ID} .gos-submit:disabled{opacity:.5;cursor:not-allowed}
      #${PICKER_ID} .gos-error{min-height:20px;margin-top:8px;color:#b91c1c;font-size:13px}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = PICKER_ID;
    root.innerHTML = `
      <div class="gos-card" role="dialog" aria-modal="true" aria-labelledby="gosTitle">
        <div class="gos-head"><strong id="gosTitle">同期するデータを選択</strong><button type="button" class="gos-close" aria-label="閉じる">×</button></div>
        <div class="gos-body">
          <label class="gos-option"><input type="radio" name="gosMode" value="skill" checked>スキル対象のみ</label>
          <label class="gos-option"><input type="radio" name="gosMode" value="highest">全曲（最高難易度のみ）</label>
          <label class="gos-option"><input type="radio" name="gosMode" value="all">全曲（全パート）</label>
          <label class="gos-option"><input type="radio" name="gosMode" value="range">全曲（難易度幅指定）</label>
          <div class="gos-range">
            <input class="gos-min" type="number" min="0.01" max="9.99" step="0.01" placeholder="下限" disabled>
            <span>～</span>
            <input class="gos-max" type="number" min="0.01" max="9.99" step="0.01" placeholder="上限" disabled>
          </div>
          <div class="gos-error"></div>
          <div class="gos-actions"><button type="button" class="gos-submit">同期する</button></div>
        </div>
      </div>`;
    document.documentElement.appendChild(root);

    const minInput = root.querySelector('.gos-min');
    const maxInput = root.querySelector('.gos-max');
    const errorEl = root.querySelector('.gos-error');
    const submit = root.querySelector('.gos-submit');

    function selectedMode() {
      return root.querySelector('input[name="gosMode"]:checked')?.value || 'skill';
    }
    function refreshRange() {
      const enabled = selectedMode() === 'range';
      minInput.disabled = !enabled;
      maxInput.disabled = !enabled;
      errorEl.textContent = '';
    }
    root.querySelectorAll('input[name="gosMode"]').forEach(input => input.addEventListener('change', refreshRange));
    root.querySelector('.gos-close').addEventListener('click', () => {
      cleanupPicker();
      window[RUNNING_KEY] = false;
    });
    root.addEventListener('click', event => {
      if (event.target === root) {
        cleanupPicker();
        window[RUNNING_KEY] = false;
      }
    });
    submit.addEventListener('click', async () => {
      errorEl.textContent = '';
      const mode = selectedMode();
      let minLevel = null;
      let maxLevel = null;
      if (mode === 'range') {
        minLevel = Number(minInput.value);
        maxLevel = Number(maxInput.value);
        if (!Number.isFinite(minLevel) || !Number.isFinite(maxLevel) || minLevel <= 0 || maxLevel <= 0 || minLevel > maxLevel) {
          errorEl.textContent = '難易度の下限・上限を正しく入力してください。';
          return;
        }
      }
      submit.disabled = true;
      submit.textContent = '準備中...';
      try {
        if (mode === 'skill') {
          cleanupPicker();
          await runSkillTargetSync();
        } else {
          await startFullSync(mode, minLevel, maxLevel);
          cleanupPicker();
        }
      } catch (error) {
        submit.disabled = false;
        submit.textContent = '同期する';
        errorEl.textContent = error?.message || String(error);
      }
    });
  }

  function ensureSimpleProgress(message) {
    let box = document.getElementById('gitadora-skill-simulator-sync');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gitadora-skill-simulator-sync';
      Object.assign(box.style, {
        position:'fixed', left:'12px', right:'12px', top:'12px', zIndex:'2147483647',
        padding:'12px 14px', borderRadius:'10px', background:'rgba(2,6,23,.96)', color:'#fff',
        fontSize:'14px', fontWeight:'700', lineHeight:'1.5', boxShadow:'0 6px 30px rgba(0,0,0,.35)'
      });
      document.documentElement.appendChild(box);
    }
    box.textContent = message;
    return box;
  }

  async function runSkillTargetSync() {
    const targets = [
      ['GF','HOT','gf',1], ['GF','OTHER','gf',0], ['DM','HOT','dm',1], ['DM','OTHER','dm',0]
    ];
    const records = [];
    const counts = {};
    const box = ensureSimpleProgress('GITADORA スキル同期を開始します…');

    try {
      for (let i=0; i<targets.length; i++) {
        const [instrument, category, gtype, stype] = targets[i];
        box.textContent = `取得中… ${instrument} ${category} (${i+1}/4)`;
        const url = `/game/gfdm/${VERSION_SLUG}/p/playdata/skill.html?gtype=${gtype}&stype=${stype}`;
        const response = await fetch(url, { credentials:'include', cache:'no-store' });
        if (!response.ok) throw new Error(`${instrument} ${category} の取得に失敗しました。`);
        const html = await response.text();
        if (html.includes('e-amusementへのログインが必要') || html.includes('ログインした状態で')) {
          throw new Error('e-amusementへのログインが必要です。');
        }
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rows = [...doc.querySelectorAll('tr')]
          .filter(row => row.querySelector('.achive_cell') && row.querySelector('.music_seq_box'))
          .slice(0,25);
        counts[`${instrument}_${category}`] = rows.length;
        for (const row of rows) {
          const title = (row.querySelector('.title img[alt]')?.getAttribute('alt') || row.querySelector('.title .text_link')?.textContent || '').trim();
          const seqBox = row.querySelector('.music_seq_box');
          const partEl = seqBox?.querySelector('[class*="part_"]');
          const diffEl = seqBox?.querySelector('[class*="diff_"]');
          const partName = [...(partEl?.classList || [])].find(c => c.startsWith('part_'))?.slice(5);
          const diffName = [...(diffEl?.classList || [])].find(c => c.startsWith('diff_'))?.slice(5);
          const part = PART_MAP[partName];
          const diff = DIFF_MAP[diffName];
          const rate = parseFloat((row.querySelector('.achive_cell')?.textContent || '').replace('%','').trim());
          const level = parseFloat((row.querySelector('.diff_cell')?.textContent || '').trim());
          if (title && part && diff && Number.isFinite(rate) && Number.isFinite(level)) {
            records.push({ title, part:`${diff}-${part}`, rate, level, instrument, category });
          }
        }
      }
      box.textContent = `取得完了：${records.length}件。Skill Simulatorへ戻ります…`;
      const payload = { type:'GITADORA_SKILL_SYNC', version:2, eamusement_slug:VERSION_SLUG, records, counts };
      location.href = RETURN_URL + '#skill-sync=' + encodeURIComponent(JSON.stringify(payload));
    } catch (error) {
      window[RUNNING_KEY] = false;
      box.textContent = `同期失敗：${error?.message || error}`;
      throw error;
    }
  }

  function waitForBridgeReady(appWindow, syncId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Skill Simulatorとの接続が時間切れになりました。')); }, 120000);
      function cleanup() { clearTimeout(timer); window.removeEventListener('message', onMessage); }
      function onMessage(event) {
        if (event.origin !== APP_ORIGIN || event.source !== appWindow) return;
        const data = event.data || {};
        if (data.type !== 'GITADORA_OFFICIAL_SYNC_READY' || data.syncId !== syncId) return;
        cleanup();
        if (data.error) reject(new Error(data.error)); else resolve();
      }
      window.addEventListener('message', onMessage);
    });
  }

  function loadAllScoreHelper() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://gitadorafc.github.io/skillsimulator/js/eamusement-all-scores.js?t=' + Date.now();
      script.onload = resolve;
      script.onerror = () => reject(new Error('全曲同期用スクリプトを読み込めませんでした。'));
      document.head.appendChild(script);
    });
  }

  async function startFullSync(mode, minLevel, maxLevel) {
    const syncId = crypto.randomUUID();
    const payload = { syncId, slug:VERSION_SLUG, mode, minLevel, maxLevel };
    const appWindow = window.open(RETURN_URL + '#official-sync-bridge=' + encodeURIComponent(JSON.stringify(payload)), '_blank');
    if (!appWindow) throw new Error('ポップアップを許可して再実行してください。');
    await waitForBridgeReady(appWindow, syncId);
    window.__GITADORA_OFFICIAL_SYNC_LAUNCH__ = { ...payload, targetWindow:appWindow };
    await loadAllScoreHelper();
  }

  if (location.hash.includes('official-sync-admin=1')) {
    showPicker();
  } else {
    runSkillTargetSync().catch(error => {
      alert(`同期に失敗しました: ${error?.message || error}`);
    });
  }
})();
