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
      #${PICKER_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.62);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic",Meiryo,sans-serif;color:#f8fafc}
      #${PICKER_ID} .gos-card{width:min(92vw,500px);border:2px solid #3b82f6;border-radius:18px;background:#0f172a;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}
      #${PICKER_ID} .gos-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 12px;border-bottom:1px solid #334155}
      #${PICKER_ID} .gos-head strong{font-size:21px;font-weight:800;line-height:1.3;color:#f8fafc}
      #${PICKER_ID} .gos-close{flex:0 0 auto;min-width:86px;height:36px;padding:0 16px;border:1px solid #64748b;border-radius:10px;background:#1e293b;color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
      #${PICKER_ID} .gos-close:active{transform:translateY(1px)}
      #${PICKER_ID} .gos-body{padding:16px 18px 18px}
      #${PICKER_ID} label.gos-option{display:flex;align-items:center;gap:10px;min-height:40px;padding:2px 0;font-size:16px;font-weight:700;color:#f8fafc;cursor:pointer}
      #${PICKER_ID} input[type="radio"],#${PICKER_ID} input[type="checkbox"]{width:20px;height:20px;margin:0;accent-color:#3b82f6}
      #${PICKER_ID} .gos-device{display:flex;align-items:center;gap:18px;padding:0 0 12px;margin-bottom:8px;border-bottom:1px solid #334155}
      #${PICKER_ID} .gos-device strong{font-size:13px;color:#94a3b8;margin-right:2px}
      #${PICKER_ID} .gos-device label{display:flex;align-items:center;gap:7px;font-size:16px;font-weight:800;color:#f8fafc;cursor:pointer}
      #${PICKER_ID} .gos-range-wrap{margin:4px 0 8px 30px}
      #${PICKER_ID} .gos-range-row{display:grid;grid-template-columns:34px minmax(0,1fr) 18px minmax(0,1fr);align-items:center;gap:8px;margin-top:8px}
      #${PICKER_ID} .gos-range-row b{font-size:13px;color:#cbd5e1}
      #${PICKER_ID} .gos-range-row input{width:100%;height:38px;box-sizing:border-box;border:1px solid #64748b;border-radius:8px;padding:0 9px;background:#111827;color:#f8fafc;font-size:16px;text-align:center;outline:none}
      #${PICKER_ID} .gos-range-row input:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.18)}
      #${PICKER_ID} .gos-range-row input:disabled{opacity:.45;color:#94a3b8;background:#0b1220}
      #${PICKER_ID} .gos-range-row input::placeholder{color:#64748b;opacity:1}
      #${PICKER_ID} .gos-actions{display:flex;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid #334155}
      #${PICKER_ID} .gos-submit{min-width:112px;height:38px;padding:0 20px;border:1px solid #3b82f6;border-radius:10px;background:#3b82f6;color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
      #${PICKER_ID} .gos-submit:active{transform:translateY(1px)}
      #${PICKER_ID} .gos-submit:disabled{opacity:.5;cursor:not-allowed;transform:none}
      #${PICKER_ID} .gos-error{min-height:20px;margin-top:8px;color:#fecaca;font-size:13px;line-height:1.5}
      @media(max-width:520px){
        #${PICKER_ID}{padding:12px}
        #${PICKER_ID} .gos-card{width:min(94vw,500px)}
        #${PICKER_ID} .gos-head{padding:14px 14px 11px}
        #${PICKER_ID} .gos-head strong{font-size:19px}
        #${PICKER_ID} .gos-close{min-width:76px;height:34px;padding:0 13px}
        #${PICKER_ID} .gos-body{padding:14px}
        #${PICKER_ID} .gos-device{gap:14px}
        #${PICKER_ID} .gos-range-wrap{margin-left:28px}
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = PICKER_ID;
    root.innerHTML = `
      <div class="gos-card" role="dialog" aria-modal="true" aria-labelledby="gosTitle">
        <div class="gos-head"><strong id="gosTitle">同期するデータを選択</strong><button type="button" class="gos-close">閉じる</button></div>
        <div class="gos-body">
          <div class="gos-device"><strong>対象</strong><label><input type="checkbox" name="gosInstrument" value="GF" checked>GF</label><label><input type="checkbox" name="gosInstrument" value="DM" checked>DM</label></div>
          <label class="gos-option"><input type="radio" name="gosMode" value="skill" checked>スキル対象のみ</label>
          <label class="gos-option"><input type="radio" name="gosMode" value="highest">全曲（最高難易度のみ）</label>
          <label class="gos-option"><input type="radio" name="gosMode" value="all">全曲（全パート）</label>
          <label class="gos-option"><input type="radio" name="gosMode" value="range">全曲（難易度幅指定）</label>
          <div class="gos-range-wrap">
            <div class="gos-range-row"><b>GF</b><input class="gos-gf-min" type="number" min="0.01" max="9.99" step="0.01" placeholder="下限" disabled><span>～</span><input class="gos-gf-max" type="number" min="0.01" max="9.99" step="0.01" placeholder="上限" disabled></div>
            <div class="gos-range-row"><b>DM</b><input class="gos-dm-min" type="number" min="0.01" max="9.99" step="0.01" placeholder="下限" disabled><span>～</span><input class="gos-dm-max" type="number" min="0.01" max="9.99" step="0.01" placeholder="上限" disabled></div>
          </div>
          <div class="gos-error"></div>
          <div class="gos-actions"><button type="button" class="gos-submit">同期する</button></div>
        </div>
      </div>`;
    document.documentElement.appendChild(root);

    const gfMinInput = root.querySelector('.gos-gf-min');
    const gfMaxInput = root.querySelector('.gos-gf-max');
    const dmMinInput = root.querySelector('.gos-dm-min');
    const dmMaxInput = root.querySelector('.gos-dm-max');
    const errorEl = root.querySelector('.gos-error');
    const submit = root.querySelector('.gos-submit');

    function selectedMode() {
      return root.querySelector('input[name="gosMode"]:checked')?.value || 'skill';
    }
    function selectedInstruments() {
      return [...root.querySelectorAll('input[name="gosInstrument"]:checked')].map(input => input.value);
    }
    function refreshRange() {
      const enabled = selectedMode() === 'range';
      const instruments = selectedInstruments();
      gfMinInput.disabled = !enabled || !instruments.includes('GF');
      gfMaxInput.disabled = !enabled || !instruments.includes('GF');
      dmMinInput.disabled = !enabled || !instruments.includes('DM');
      dmMaxInput.disabled = !enabled || !instruments.includes('DM');
      errorEl.textContent = '';
    }
    root.querySelectorAll('input[name="gosMode"],input[name="gosInstrument"]').forEach(input => input.addEventListener('change', refreshRange));
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
      const instruments = selectedInstruments();
      if (!instruments.length) {
        errorEl.textContent = 'GF / DM のどちらかを選択してください。';
        return;
      }
      let gfMinLevel = null;
      let gfMaxLevel = null;
      let dmMinLevel = null;
      let dmMaxLevel = null;
      if (mode === 'range') {
        const validateRange = (label, minInput, maxInput) => {
          const min = Number(minInput.value);
          const max = Number(maxInput.value);
          if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
            throw new Error(`${label}の難易度下限・上限を正しく入力してください。`);
          }
          return [min, max];
        };
        try {
          if (instruments.includes('GF')) [gfMinLevel, gfMaxLevel] = validateRange('GF', gfMinInput, gfMaxInput);
          if (instruments.includes('DM')) [dmMinLevel, dmMaxLevel] = validateRange('DM', dmMinInput, dmMaxInput);
        } catch (error) {
          errorEl.textContent = error.message;
          return;
        }
      }
      submit.disabled = true;
      submit.textContent = '準備中...';
      try {
        if (mode === 'skill') {
          cleanupPicker();
          await runSkillTargetSync(instruments);
        } else {
          await startFullSync(mode, instruments, { gfMinLevel, gfMaxLevel, dmMinLevel, dmMaxLevel });
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

  async function runSkillTargetSync(instruments = ['GF','DM']) {
    const targets = [
      ['GF','HOT','gf',1], ['GF','OTHER','gf',0], ['DM','HOT','dm',1], ['DM','OTHER','dm',0]
    ].filter(([instrument]) => instruments.includes(instrument));
    const records = [];
    const counts = {};
    const box = ensureSimpleProgress('GITADORA スキル同期を開始します…');

    try {
      for (let i=0; i<targets.length; i++) {
        const [instrument, category, gtype, stype] = targets[i];
        box.textContent = `取得中… ${instrument} ${category} (${i+1}/${targets.length})`;
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
      const payload = { type:'GITADORA_SKILL_SYNC', version:2, eamusement_slug:VERSION_SLUG, records, counts, instruments };
      location.href = RETURN_URL + '#skill-sync=' + encodeURIComponent(JSON.stringify(payload));
    } catch (error) {
      window[RUNNING_KEY] = false;
      box.textContent = `同期失敗：${error?.message || error}`;
      throw error;
    }
  }

  function waitForBridgeReady(appWindow, syncId, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Skill Simulatorとの接続が時間切れになりました。')); }, timeoutMs);
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

  async function startFullSync(mode, instruments, ranges = {}) {
    const syncId = crypto.randomUUID();
    const payload = { syncId, slug:VERSION_SLUG, mode, instruments, ...ranges };

    // Skill Simulatorの「公式サイトを開く」から来た場合は、元タブをそのまま登録先に使う。
    // 新しいSkill Simulatorタブを開かないため、公式サイト側の進捗表示を継続できる。
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type:'GITADORA_OFFICIAL_SYNC_REQUEST', ...payload }, APP_ORIGIN);
        await waitForBridgeReady(window.opener, syncId, 5000);
        window.__GITADORA_OFFICIAL_SYNC_LAUNCH__ = { ...payload, targetWindow:window.opener };
        await loadAllScoreHelper();
        return;
      } catch (_) {
        // 手動で開いた公式タブなど、openerがSkill Simulatorでない場合は従来のブリッジへフォールバック。
      }
    }

    const appWindow = window.open(RETURN_URL + '#official-sync-bridge=' + encodeURIComponent(JSON.stringify(payload)), '_blank');
    if (!appWindow) throw new Error('ポップアップを許可して再実行してください。');
    await waitForBridgeReady(appWindow, syncId);
    window.__GITADORA_OFFICIAL_SYNC_LAUNCH__ = { ...payload, targetWindow:appWindow };
    await loadAllScoreHelper();
  }

  // 全ユーザー共通で同期対象を選択する。
  // ブックマークレットは従来の eamusement-sync.js 読み込みコードをそのまま使う。
  showPicker();
})();
