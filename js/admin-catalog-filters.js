/* Admin-only song catalog/favorites filter control. */
export function setupAdminCatalogFilters(favorite) {
  if (!document.body.classList.contains('admin-new-ui')) return;
  const controls = document.querySelector('#songCatalogMask .song-catalog-controls');
  const favoriteName = document.getElementById('songCatalogFavoriteName');
  if (!controls || !favoriteName) return;
  let toggle = document.querySelector('#songCatalogMask .admin-catalog-filter-toggle');
  let panel = controls.querySelector('.admin-catalog-filter-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'admin-catalog-filter-panel';
    while (controls.firstChild) panel.appendChild(controls.firstChild);
    controls.appendChild(panel);
  }
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-catalog-filter-toggle admin-filter-toggle-button';
    toggle.setAttribute('title', 'フィルタ');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8L4 5z"/></svg>';
    toggle.addEventListener('click', () => {
      const expanded = controls.classList.toggle('admin-catalog-filters-open');
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? 'フィルタを閉じる' : 'フィルタを開く');
    });
  }
  (favorite ? favoriteName : controls).appendChild(toggle);
  controls.classList.remove('admin-catalog-filters-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'フィルタを開く');
  controls.classList.toggle('admin-catalog-favorite-mode', favorite);
  // Favorite controls belong next to 名前を保存, not in the separate row.
  controls.classList.toggle('admin-catalog-favorite-controls', favorite);
}

