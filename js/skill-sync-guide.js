export function detectSkillSyncGuideBrowser(navigatorObject = navigator) {
  const ua = String(navigatorObject.userAgent || '');
  const isMobileDevice = /(?:Android|iPhone|iPad|iPod)/.test(ua)
    || navigatorObject.userAgentData?.mobile === true;
  const isChrome = isMobileDevice
    && /(?:Chrome\/|CriOS\/|Chromium\/)/.test(ua)
    && !/(?:EdgA?\/|EdgiOS\/|OPR\/|Opera\/)/.test(ua);
  if (isChrome) return 'chrome';

  const isSafari = /Safari\//.test(ua)
    && !/(?:Chrome\/|CriOS\/|Chromium\/|EdgA?\/|EdgiOS\/|OPR\/|FxiOS\/)/.test(ua);
  return isSafari ? 'safari' : 'other';
}

export function getSkillSyncVisualGuideMarkup(browser) {
  const isSafari = browser === 'safari';
  const browserName = isSafari ? 'Safari' : 'Chrome';
  const browserMark = isSafari
    ? '<span class="sync-browser-mark safari" aria-hidden="true"></span>'
    : '<span class="sync-browser-mark chrome" aria-hidden="true"></span>';
  const bookmarkFigure = isSafari
    ? `
      <div class="sync-mini-browser safari" aria-hidden="true">
        <div class="sync-mini-address">gitadorafc.github.io</div>
        <div class="sync-mini-toolbar"><span>‹</span><strong class="sync-mini-toolbar-icon sync-mini-share-icon"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8h14v-8"/></svg></strong><span>▢</span></div>
        <div class="sync-mini-callout">共有 → ブックマークに追加</div>
      </div>`
    : `
      <div class="sync-mini-browser chrome" aria-hidden="true">
        <div class="sync-mini-address">gitadorafc.github.io <strong>︙</strong></div>
        <div class="sync-mini-menu"><span>新しいタブ</span><strong>☆ ブックマーク</strong></div>
      </div>`;
  const bookmarkHelp = isSafari
    ? '共有ボタンから「ブックマークに追加」を選択します。'
    : '︙メニューから「☆ ブックマーク」を選択します。';
  const runFigure = isSafari
    ? `
      <div class="sync-mini-browser sync-mini-run safari" aria-hidden="true">
        <div class="sync-mini-address">GITADORA公式サイト</div>
        <div class="sync-mini-toolbar"><span>‹</span><strong class="sync-mini-toolbar-icon sync-mini-book-icon"><svg viewBox="0 0 24 24"><path d="M3 5.5c3.2-.8 6-.1 9 2.1v11c-3-2.2-5.8-2.9-9-2.1v-11Zm18 0c-3.2-.8-6-.1-9 2.1v11c3-2.2 5.8-2.9 9-2.1v-11Z"/></svg></strong><span>▢</span></div>
        <div class="sync-mini-callout">同期用ブックマークを実行</div>
      </div>`
    : `
      <div class="sync-mini-browser sync-mini-run chrome" aria-hidden="true">
        <div class="sync-mini-search">同期用ブックマーク</div>
        <div class="sync-mini-suggestion"><strong><i class="sync-mini-globe"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5 7.5 8.2 5l2.2.8.8 2.4-1.7 1.6-2.8-.5L5 7.5Zm6.5 3 3-1.2 3.2 1.5.5 2.7-2.2 1.1-.8 3-2.1 1.1-1.4-2.8-2-.9.4-2.8 2.4-1.7Z"/></svg></i>同期用ブックマーク</strong><span>候補から選択</span></div>
      </div>`;
  const runHelp = isSafari
    ? '公式サイトを開いたまま、作成した同期用ブックマークを実行します。'
    : '公式サイトを開き、アドレスバーにブックマーク名を入力して、表示された候補を選択します。';

  return `
    <div class="sync-visual-device">${browserMark}<strong>${browserName}</strong></div>

    <div class="sync-visual-card">
      <span class="sync-visual-no">1</span>
      <div class="sync-mini-copy" aria-hidden="true"><span>SYNC CODE</span><strong>ABC1234</strong><i class="sync-mini-copy-icon"><svg viewBox="0 0 24 24"><rect x="8" y="7" width="11" height="13" rx="1.5"/><path d="M16 7V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v11A1.5 1.5 0 0 0 5.5 18H8"/></svg></i></div>
      <div class="sync-visual-content">
        <strong>同期コードをコピー</strong>
        <button type="button" class="sync-visual-primary" data-sync-guide-action="copy">コードをコピー</button>
      </div>
    </div>

    <div class="sync-visual-card">
      <span class="sync-visual-no">2</span>
      ${bookmarkFigure}
      <div class="sync-visual-content">
        <strong>このページをブックマーク</strong>
        <p>${bookmarkHelp}</p>
      </div>
    </div>

    <div class="sync-visual-card">
      <span class="sync-visual-no">3</span>
      <div class="sync-mini-edit" aria-hidden="true">
        <b>ブックマークを編集</b>
        <span>同期用ブックマーク</span>
        <strong>javascript:…</strong>
      </div>
      <div class="sync-visual-content">
        <strong>ブックマークを編集</strong>
        <p class="sync-bookmark-name">同期用ブックマーク<br><small>（お好きな名前で自由に設定してください）</small></p>
        <p>URLを全削除し、コピーしたコードを貼り付けます。</p>
      </div>
    </div>

    <div class="sync-visual-card sync-visual-run-card">
      <span class="sync-visual-no">4</span>
      ${runFigure}
      <div class="sync-visual-content">
        <strong>同期する</strong>
        <button type="button" class="sync-visual-primary" data-sync-guide-action="open">GITADORA公式サイトを開く</button>
        <p>${runHelp}</p>
      </div>
    </div>

    <div class="skill-sync-card-warning">
      ⚠ 複数カードがある場合、参照するカードが合っているかご確認ください。
    </div>`;
}
