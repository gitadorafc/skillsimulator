// Admin-exclusive color mapping for rendered part badges.
// Public renderers and public CSS deliberately remain untouched.
const PARTS = new Set(['MAS-G','MAS-B','EXT-G','EXT-B','ADV-G','ADV-B','BSC-G','BSC-B']);
let observer = null;

function decorate(root) {
  if (!document.body.classList.contains('admin-new-ui')) return;
  const badges = [];
  if (root.nodeType === 1 && root.matches?.('.p-badge')) badges.push(root);
  root.querySelectorAll?.('.p-badge').forEach(badge => badges.push(badge));
  for (const badge of badges) {
    const part = badge.textContent.trim().toUpperCase();
    if (PARTS.has(part)) badge.dataset.adminPart = part;
    else badge.removeAttribute('data-admin-part');
  }
}

export function installAdminColorTheme() {
  if (!document.body.classList.contains('admin-new-ui')) return;
  if (observer) return;
  const root = document.getElementById('appRoot');
  if (!root) return;
  decorate(root);
  observer = new MutationObserver(changes => {
    if (!document.body.classList.contains('admin-new-ui')) return;
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
