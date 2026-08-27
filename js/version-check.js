(() => {
  'use strict';

  const CHECK_INTERVAL_MS = 10 * 60 * 1000;
  const PENDING_RETRY_MS = 5000;
  const USER_IDLE_MS = 60 * 1000;
  const RELOAD_RETRY_MS = 60 * 1000;
  const RELOAD_RETRY_WINDOW_MS = 15 * 60 * 1000;
  const MAX_RELOAD_ATTEMPTS = 3;
  const VERSION_URL = './version.json';
  const RELOAD_GUARD_KEY = 'gitadora_auto_reload_guard';
  const currentVersion = document.querySelector('meta[name="app-version"]')?.content?.trim() || '';

  let checking = false;
  let pendingVersion = '';
  let pendingTimer = 0;
  let hasUserInteracted = false;
  let lastUserActivityAt = 0;

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && element.getClientRects().length > 0;
  }

  function isEditable(element) {
    return element instanceof HTMLInputElement
      || element instanceof HTMLTextAreaElement
      || element instanceof HTMLSelectElement
      || element?.isContentEditable === true;
  }

  function hasAuthInput() {
    const authScreen = document.getElementById('authScreen');
    if (!isVisible(authScreen)) return false;
    return [...authScreen.querySelectorAll('input')]
      .some(input => String(input.value || '').length > 0);
  }

  function hasBlockingScreen() {
    if (isEditable(document.activeElement) || hasAuthInput()) return true;

    return [...document.querySelectorAll('[id$="Mask"], [class*="-mask"], [class*="-modal"]')]
      .some(element => isVisible(element));
  }

  function hasPendingSync() {
    if (location.hash.startsWith('#skill-sync=')) return true;
    try {
      return Boolean(sessionStorage.getItem('gitadora_pending_skill_sync'));
    } catch (_) {
      return false;
    }
  }

  function isUserIdle() {
    return !hasUserInteracted || Date.now() - lastUserActivityAt >= USER_IDLE_MS;
  }

  function canReloadNow() {
    return !document.hidden
      && !hasBlockingScreen()
      && !hasPendingSync()
      && isUserIdle();
  }

  function clearPendingTimer() {
    if (!pendingTimer) return;
    window.clearTimeout(pendingTimer);
    pendingTimer = 0;
  }

  function schedulePendingReload(delay = PENDING_RETRY_MS) {
    clearPendingTimer();
    if (!pendingVersion) return;
    pendingTimer = window.setTimeout(() => {
      pendingTimer = 0;
      tryPendingReload();
    }, Math.max(PENDING_RETRY_MS, delay));
  }

  function readReloadGuard() {
    try {
      const guard = JSON.parse(sessionStorage.getItem(RELOAD_GUARD_KEY) || 'null');
      return guard && typeof guard === 'object' ? guard : null;
    } catch (_) {
      return null;
    }
  }

  function getReloadDelay(version) {
    const now = Date.now();
    const guard = readReloadGuard();
    if (!guard || guard.version !== version || now - Number(guard.windowStartedAt || 0) >= RELOAD_RETRY_WINDOW_MS) {
      return 0;
    }

    const attempts = Number(guard.attempts || 0);
    const lastAttemptAt = Number(guard.lastAttemptAt || 0);
    if (attempts >= MAX_RELOAD_ATTEMPTS) {
      return Math.max(PENDING_RETRY_MS, Number(guard.windowStartedAt || 0) + RELOAD_RETRY_WINDOW_MS - now);
    }
    return Math.max(0, lastAttemptAt + RELOAD_RETRY_MS - now);
  }

  function recordReloadAttempt(version) {
    try {
      const now = Date.now();
      const previous = readReloadGuard();
      const sameWindow = previous
        && previous.version === version
        && now - Number(previous.windowStartedAt || 0) < RELOAD_RETRY_WINDOW_MS;
      sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({
        version,
        attempts: sameWindow ? Number(previous.attempts || 0) + 1 : 1,
        lastAttemptAt: now,
        windowStartedAt: sameWindow ? Number(previous.windowStartedAt || now) : now
      }));
    } catch (_) {}
  }

  function reloadForVersion(version) {
    if (!version || version === currentVersion) return;

    const reloadDelay = getReloadDelay(version);
    if (reloadDelay > 0) {
      schedulePendingReload(reloadDelay);
      return;
    }

    recordReloadAttempt(version);
    const url = new URL(location.href);
    url.searchParams.set('appv', version);
    location.replace(url.href);
  }

  function tryPendingReload() {
    if (!pendingVersion) return;
    if (!canReloadNow()) {
      const idleDelay = hasUserInteracted
        ? Math.max(PENDING_RETRY_MS, USER_IDLE_MS - (Date.now() - lastUserActivityAt))
        : PENDING_RETRY_MS;
      schedulePendingReload(idleDelay);
      return;
    }
    reloadForVersion(pendingVersion);
  }

  function applyAvailableVersion(version) {
    if (!version || version === currentVersion) {
      pendingVersion = '';
      clearPendingTimer();
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch (_) {}
      return;
    }

    pendingVersion = version;
    tryPendingReload();
  }

  async function checkForUpdate() {
    if (checking || document.hidden || hasPendingSync()) return;
    checking = true;
    try {
      const separator = VERSION_URL.includes('?') ? '&' : '?';
      const response = await fetch(`${VERSION_URL}${separator}t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) return;
      const data = await response.json();
      applyAvailableVersion(String(data?.version || '').trim());
    } catch (_) {
      // オフラインや一時的な通信失敗では、現在の画面をそのまま使用する。
    } finally {
      checking = false;
    }
  }

  function recordUserActivity() {
    hasUserInteracted = true;
    lastUserActivityAt = Date.now();
    if (pendingVersion) schedulePendingReload(USER_IDLE_MS);
  }

  for (const eventName of ['pointerdown', 'touchstart', 'keydown', 'input', 'change']) {
    document.addEventListener(eventName, recordUserActivity, { passive: true });
  }

  window.addEventListener('load', () => {
    window.setTimeout(checkForUpdate, 2000);
  }, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate();
  });
  window.addEventListener('pageshow', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
})();
