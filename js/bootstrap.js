const PARTIAL_URLS = [
  '../partials/app.html?v=4_34_2',
  '../partials/menu.html?v=4_34_2',
  '../partials/dialogs.html?v=4_34_2',
  '../partials/admin.html?v=4_34_2',
  '../partials/board.html?v=4_34_2'
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

  await import('./app.js?v=4_34_2');
  await loadClassicScript('./js/version-check.js?v=4_34_2');
}

bootstrap().catch(error => {
  console.error('bootstrap failed:', error);
  const root = document.getElementById('appRoot');
  if (root) {
    root.innerHTML = '<div class="app-loading-screen"><div class="app-loading-content"><strong>画面の読み込みに失敗しました</strong><span>ページを再読み込みしてください。</span></div></div>';
  }
});
