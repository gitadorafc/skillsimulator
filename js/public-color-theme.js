// Public UI part-badge decoration; auth / administrative permissions are not affected.
// Mirrors the accepted color palette without importing administrator UI code.
const PARTS = new Set(['MAS-G','MAS-B','EXT-G','EXT-B','ADV-G','ADV-B','BSC-G','BSC-B']);
let observer = null;
function decorate(node) {
  if (!document.body.classList.contains('public-palette-ui')) return;
  const badges = [];
  if (node.nodeType === 1 && node.matches?.('.p-badge')) badges.push(node);
  node.querySelectorAll?.('.p-badge').forEach(badge => badges.push(badge));
  for (const badge of badges) {
    const part = badge.textContent.trim().toUpperCase();
    if (PARTS.has(part)) badge.dataset.publicPart = part;
    else badge.removeAttribute('data-public-part');
  }
}
export function installPublicColorTheme() {
  if (observer || !document.body.classList.contains('public-palette-ui')) return;
  const root = document.getElementById('appRoot');
  if (!root) return;
  decorate(root);
  observer = new MutationObserver(changes => {
    if (!document.body.classList.contains('public-palette-ui')) return;
    for (const change of changes) {
      if (change.type === 'characterData') {
        const badge = change.target.parentElement?.closest('.p-badge');
        if (badge) decorate(badge);
      }
      for (const node of change.addedNodes) {
        if (node.nodeType === 1) decorate(node);
        else if (node.nodeType === 3) {
          const badge = node.parentElement?.closest('.p-badge');
          if (badge) decorate(badge);
        }
      }
    }
  });
  observer.observe(root, {subtree:true, childList:true, characterData:true});
}
