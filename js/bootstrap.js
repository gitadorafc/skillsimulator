const PARTIAL_URLS = [
  '../partials/app.html?v=4_37_36',
  '../partials/menu.html?v=4_37_1',
  '../partials/dialogs.html?v=4_37_36',
  '../partials/admin.html?v=4_37_82',
  '../partials/board.html?v=4_37_1',
  '../partials/tutorial.html?v=4_37_1',
  '../partials/admin-app.html?v=4_38_3',
  '../partials/admin-score-editor.html?v=4_40_48'
];

async function fetchPartial(url) {
  const response = await fetch(new URL(url, import.meta.url), {
    cache: 'no-cache',
    credentials: 'same-origin'
  });
  if (!response.ok) throw new Error(`UIの読み込みに失敗しました: ${response.status}`);
  return response.text();
}

async function loadClassicScript(src) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`スクリプトの読み込みに失敗しました: ${src}`));
    document.body.appendChild(script);
  });
}

async function bootstrap() {
  const root = document.getElementById('appRoot');
  if (!root) throw new Error('appRoot が見つかりません。');

  const parts = await Promise.all(PARTIAL_URLS.map(fetchPartial));
  root.innerHTML = parts.join('\n');

  // 未ログインの初回訪問では認証確認中のローディングを表示しない。
  // 保存済みセッションがある場合は認証確認まで従来のローディングを維持する。
  // localStorageの読み取りに失敗した場合も、誤ってログイン画面を先出ししない。
  let hasStoredSession = true;
  try {
    hasStoredSession = Object.keys(localStorage).some(key =>
      /^sb-[a-z0-9]+-auth-token$/i.test(key) && Boolean(localStorage.getItem(key))
    );
  } catch (_) {}
  const isAuthCallback = /(?:^|[&#])(?:access_token|refresh_token|code)=/.test(location.hash);
  if (!hasStoredSession && !isAuthCallback) {
    document.getElementById('appLoadingScreen')?.classList.add('hidden');
    document.getElementById('introScreen')?.classList.remove('hidden');
  }

  await import('./app.js?v=4_37_86');
  await loadClassicScript('./js/version-check.js?v=4_37_1');
}

bootstrap().catch(error => {
  console.error('bootstrap failed:', error);
  const root = document.getElementById('appRoot');
  if (root) {
    root.innerHTML = '<div class="app-loading-screen" data-nosnippet><div class="app-loading-content"><strong>画面の読み込みに失敗しました</strong><span>ページを再読み込みしてください。</span></div></div>';
  }
});
