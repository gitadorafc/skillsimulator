/** Admin-only profile startup alignment for iOS WebKit.
 * The viewed profile uses the very same public CSS animations as the own
 * header. Synchronize once when profile values are mounted, then leave
 * their clocks alone until the next profile opens. No scroll/mutation seeks.
 */
const EFFECTS = new Set([
  'skill-sparkle-text-sweep','skill-sparkle-text-glow',
  'skill-sparkle-band-pulse','admin-song-border-pulse'
]);
let synced = new WeakSet();
export function isAdminIosWebKit() {
  return document.documentElement.classList.contains('ios-webkit') &&
    document.body.classList.contains('admin-new-ui');
}
export function resetAdminIosDetailPulse() {
  synced = new WeakSet();
}
export function alignAdminIosDetailPulse() {
  if (!isAdminIosWebKit()) return;
  const page = document.getElementById('userDetailPage');
  if (!page?.classList.contains('user-detail-open')) return;
  const own = document.querySelector('#appScreen>.p-header .score-val.score-rank-sparkle-rainbow');
  const ownClock = own?.getAnimations?.({subtree:false})?.find(a =>
    a.animationName === 'skill-sparkle-text-glow' && a.startTime != null);
  if (!ownClock) return;
  const elements = [...page.querySelectorAll(
    '.user-detail-summary .score-val.score-rank-sparkle-rainbow, .ar-record.skill-row-sparkle-rainbow, .ar-skill.skill-box-sparkle-rainbow'
  )];
  // Animations already aligned keep advancing undisturbed. Re-rendering or
  // loading additional records only synchronizes newly created animations.
  for (const element of elements) {
    for (const animation of element.getAnimations?.({subtree:true}) || []) {
      if (!EFFECTS.has(animation.animationName) || animation.startTime == null || synced.has(animation)) continue;
      try { animation.startTime = ownClock.startTime; synced.add(animation); } catch (_) { /* pending CSS animation */ }
    }
  }
}
