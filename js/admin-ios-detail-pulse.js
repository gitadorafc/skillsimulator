/** Admin-only iPhone Safari detail animation phase alignment.
 * Keep the user-detail animations on the SAME document clock as the own
 * header.  In particular, never seek currentTime or rewrite CSS delays
 * while scrolling: both operations can restart WebKit's sticky-layer paint.
 */
const aligned = new WeakSet();
const effectNames = new Set([
  'skill-sparkle-text-sweep',
  'skill-sparkle-text-glow',
  'skill-sparkle-band-pulse',
  'admin-song-border-pulse'
]);

export function isAdminIosWebKit() {
  return document.documentElement.classList.contains('ios-webkit') &&
    document.body.classList.contains('admin-new-ui');
}

export function alignAdminIosDetailPulse() {
  if (!isAdminIosWebKit()) return;
  const page = document.getElementById('userDetailPage');
  if (!page?.classList.contains('user-detail-open')) return;
  const own = document.querySelector('#appScreen>.p-header .score-val.score-rank-sparkle-rainbow');
  const ownClock = own?.getAnimations?.({subtree:false})?.find(
    animation => animation.animationName === 'skill-sparkle-text-glow' &&
      Number.isFinite(Number(animation.startTime)) && animation.startTime != null
  );
  if (!ownClock) return;
  const clockStart = ownClock.startTime;
  // Align an animation only on creation. Repeated startTime/currentTime writes
  // (notably from scroll and animationstart) cause visible jumps in Safari.
  const values = page.querySelectorAll('.user-detail-summary .score-val.score-rank-sparkle-rainbow, .ar-record.skill-row-sparkle-rainbow, .ar-skill.skill-box-sparkle-rainbow');
  values.forEach(value => {
    const animations = value.getAnimations?.({subtree:true}) || [];
    animations.forEach(animation => {
      if (!effectNames.has(animation.animationName) || aligned.has(animation)) return;
      if (animation.startTime == null) return;
      try {
        animation.startTime = clockStart;
        aligned.add(animation);
      } catch (_) {
        // WebKit can refuse writes for pending animations; CSS runs naturally.
      }
    });
  });
}
