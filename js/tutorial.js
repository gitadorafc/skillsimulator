const $ = id => document.getElementById(id);

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function createTutorialController({
  openMenu,
  closeMenu,
  switchTab,
  getCompleted,
  markCompleted,
  onError = console.warn
}) {
  const layer = $('tutorialLayer');
  const spotlight = $('tutorialSpotlight');
  const card = $('tutorialCard');
  const title = $('tutorialTitle');
  const text = $('tutorialText');
  const stepLabel = $('tutorialStepLabel');
  const back = $('btnTutorialBack');
  const next = $('btnTutorialNext');
  const skip = $('btnTutorialSkip');

  let active = false;
  let index = 0;
  let resizeTimer = null;

  const steps = [
    {
      title: 'GITADORA Skill Simulatorへようこそ',
      text: '最初に、基本的な使い方をかんたんに案内します。<br>あとからMENUの<strong>「チュートリアルをもう一度見る」</strong>で再確認できます。'
    },
    {
      selector: '.header-mode-controls .instrument-switch',
      title: 'GF / DMを切り替える',
      text: 'ここで<strong>GuitarFreaks（GF）</strong>と<strong>DrumMania（DM）</strong>を切り替えます。表示中のスキル対象や登録データも連動して切り替わります。'
    },
    {
      selector: '[data-tab="SKILL"]',
      title: 'スキル対象を確認',
      text: '「スキル対象」では、HOT / OTHERそれぞれの上位25曲とTOTALスキルを確認できます。',
      before: async () => { closeMenu(); await switchTab('SKILL'); }
    },
    {
      selector: '[data-tab="RECORDS"]',
      title: 'スコアを登録・編集',
      text: '「登録」ではスキル対象外の曲も含めて管理できます。＋登録から手動追加し、登録済みの曲をタップすると編集できます。',
      before: async () => { closeMenu(); await switchTab('RECORDS'); }
    },
    {
      selector: '[data-tab="USERS"]',
      title: 'ライバルを見つける',
      text: '「ユーザーリスト」から他のユーザーを確認し、GF / DMそれぞれライバル登録できます。曲詳細ではライバルとの達成率比較もできます。',
      before: async () => { closeMenu(); await switchTab('USERS'); }
    },
    {
      selector: '#btnMenuSkillSync',
      title: '公式サイトから同期',
      text: 'MENUの<strong>「公式サイト同期」</strong>から、スキル対象のみ・全曲など同期する範囲を選べます。最初にスコアを取り込む場合はここから進めるのがおすすめです。',
      before: async () => { openMenu(); await nextFrame(); }
    },
    {
      selector: '#btnMenuFeatureSettings',
      title: '機能設定を変更',
      text: 'MENUの<strong>「機能設定」</strong>では、表示テーマ・スキル対象の表示方法・文字サイズ・GFのデフォルトオプションを変更できます。登録曲やXアカウント情報の公開範囲もここで設定します。',
      before: async () => { openMenu(); await nextFrame(); }
    },
    {
      selector: '#btnMenuMypage',
      title: 'アカウント設定',
      text: 'MENUの<strong>「マイページ」</strong>では、ユーザー名・パスワード・X IDを変更できます。利用できる場合は、この端末に保存したユーザーへの切り替えも行えます。',
      before: async () => { openMenu(); await nextFrame(); }
    },
    {
      selector: '#versionSelect',
      title: 'ゲームバージョンを切り替える',
      text: 'MENU下部の<strong>VERSION</strong>から、表示・登録するGITADORAのゲームバージョンを切り替えます。',
      before: async () => { openMenu(); await nextFrame(); }
    },
    {
      selector: '#btnMenuTutorial',
      title: 'いつでも見直せます',
      text: '操作に迷ったらMENUの<strong>「使い方」</strong>を確認できます。このチュートリアルも<strong>「チュートリアルをもう一度見る」</strong>から何度でも再表示できます。',
      before: async () => { openMenu(); await nextFrame(); }
    }
  ];

  function clearPosition() {
    card.style.left = '';
    card.style.right = '';
    card.style.top = '';
    card.style.bottom = '';
    card.style.transform = '';
    card.classList.remove('tutorial-card-centered', 'tutorial-card-mobile-top');
  }

  function isRectVisible(rect) {
    return rect.width > 0 && rect.height > 0
      && rect.bottom > 8 && rect.right > 8
      && rect.top < window.innerHeight - 8
      && rect.left < window.innerWidth - 8;
  }

  async function ensureTargetVisible(target) {
    if (!target) return null;
    let rect = target.getBoundingClientRect();
    const edge = 24;
    if (
      rect.top < edge || rect.bottom > window.innerHeight - edge
      || rect.left < edge || rect.right > window.innerWidth - edge
    ) {
      target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
      await nextFrame();
      rect = target.getBoundingClientRect();
    }
    return rect;
  }

  function placeCard(rect) {
    clearPosition();
    if (!rect) {
      card.classList.add('tutorial-card-centered');
      return;
    }

    const margin = 14;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const mobile = window.matchMedia('(max-width:600px)').matches;
    const cardHeight = card.offsetHeight || 240;

    if (mobile) {
      card.style.left = '12px';
      card.style.right = '12px';
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      if (spaceBelow >= cardHeight + 12) {
        card.style.top = `${Math.max(12, rect.bottom + margin)}px`;
        return;
      }
      if (spaceAbove >= cardHeight + 12) {
        card.style.top = `${Math.max(12, rect.top - cardHeight - margin)}px`;
        return;
      }

      if (rect.top < viewportHeight / 2) {
        card.style.bottom = 'calc(12px + env(safe-area-inset-bottom))';
      } else {
        card.classList.add('tutorial-card-mobile-top');
      }
      return;
    }

    const width = Math.min(390, viewportWidth - 32);
    const left = Math.min(Math.max(16, rect.left), viewportWidth - width - 16);
    let top = rect.bottom + margin;
    if (top + cardHeight > viewportHeight - 16) {
      top = rect.top - cardHeight - margin;
    }
    top = Math.max(16, Math.min(top, viewportHeight - cardHeight - 16));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function updateHighlight() {
    if (!active) return;
    const step = steps[index];
    const target = step.selector ? document.querySelector(step.selector) : null;
    if (!target) {
      layer.classList.remove('has-target');
      spotlight.classList.add('hidden');
      placeCard(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    if (!isRectVisible(rect)) {
      layer.classList.remove('has-target');
      spotlight.classList.add('hidden');
      placeCard(null);
      return;
    }

    const pad = 6;
    const left = Math.max(4, rect.left - pad);
    const top = Math.max(4, rect.top - pad);
    const right = Math.min(window.innerWidth - 4, rect.right + pad);
    const bottom = Math.min(window.innerHeight - 4, rect.bottom + pad);
    layer.classList.add('has-target');
    spotlight.classList.remove('hidden');
    spotlight.style.left = `${left}px`;
    spotlight.style.top = `${top}px`;
    spotlight.style.width = `${Math.max(20, right - left)}px`;
    spotlight.style.height = `${Math.max(20, bottom - top)}px`;
    spotlight.style.borderRadius = `${Math.max(10, Math.min(18, parseFloat(getComputedStyle(target).borderRadius) || 12))}px`;
    placeCard(rect);
  }

  async function renderStep() {
    const step = steps[index];
    if (step.before) await step.before();
    await nextFrame();

    stepLabel.textContent = `${index + 1} / ${steps.length}`;
    title.textContent = step.title;
    text.innerHTML = step.text;
    back.classList.toggle('hidden', index === 0);
    next.textContent = index === steps.length - 1 ? '完了' : '次へ';

    const target = step.selector ? document.querySelector(step.selector) : null;
    if (target) await ensureTargetVisible(target);
    await nextFrame();
    updateHighlight();
  }

  async function finish({ skipped = false } = {}) {
    if (!active) return;
    active = false;
    layer.classList.add('hidden');
    layer.classList.remove('has-target');
    spotlight.classList.add('hidden');
    layer.setAttribute('aria-hidden', 'true');
    card.style.transform = '';
    closeMenu();
    await switchTab('SKILL');
    try {
      await markCompleted();
    } catch (error) {
      onError('チュートリアル完了状態を保存できませんでした:', error);
    }
    if (skipped) return;
  }

  async function start({ force = false } = {}) {
    if (active) return;
    if (!force) {
      try {
        const completed = await getCompleted();
        if (completed) return;
      } catch (error) {
        onError('チュートリアル状態を確認できませんでした:', error);
        return;
      }
    }
    active = true;
    index = 0;
    layer.classList.remove('hidden');
    layer.setAttribute('aria-hidden', 'false');
    await renderStep();
  }

  back.addEventListener('click', async () => {
    if (!active || index <= 0) return;
    index -= 1;
    await renderStep();
  });
  next.addEventListener('click', async () => {
    if (!active) return;
    if (index >= steps.length - 1) {
      await finish();
      return;
    }
    index += 1;
    await renderStep();
  });
  skip.addEventListener('click', () => { void finish({ skipped: true }); });
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateHighlight, 80);
  });
  window.addEventListener('scroll', updateHighlight, true);

  return { start, finish, isActive: () => active };
}
