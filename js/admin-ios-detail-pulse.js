/** Admin-only iOS Safari profile pulse: share the own-header CSS clock.
 *  Safari may re-rasterize the sticky profile while scrolling. A single CSS
 *  negative delay preserves phase without repeatedly seeking WAAPI animations.
 */
export function isAdminIosWebKit() {
  return document.documentElement.classList.contains('ios-webkit') &&
    document.body.classList.contains('admin-new-ui');
}

export function alignAdminIosDetailPulse() {
  if (!isAdminIosWebKit()) return;
  const page = document.getElementById('userDetailPage');
  if (!page?.classList.contains('user-detail-open')) return;
  const own = document.querySelector('#appScreen>.p-header .score-val.score-rank-sparkle-rainbow');
  if (!own) return;
  const animation = own.getAnimations?.({subtree:false})?.find(
    entry => entry.animationName === 'skill-sparkle-text-sweep'
  );
  const cssDuration = Number.parseFloat(getComputedStyle(own).getPropertyValue('--skill-sparkle-cycle')) || 1.6;
  const durationMs = cssDuration * 1000;
  const current = Number(animation?.currentTime);
  // If WebKit hasn't committed the header animation yet, leave its natural
  // CSS timing in place rather than applying a speculative phase.
  if (!Number.isFinite(current) || current < 0) return;
  const phase = ((current % durationMs) + durationMs) % durationMs;
  page.style.setProperty('--admin-detail-pulse-offset', `${-phase.toFixed(2)}ms`);
}
