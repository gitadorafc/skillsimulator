const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function renderAdminMasterPager({ totalPages, currentPage }) {
  if (totalPages <= 1) return '';

  const pageOptions = Array.from({ length: totalPages }, (_, index) => `
    <option value="${index}" ${index === currentPage ? 'selected' : ''}>
      ${index + 1} / ${totalPages}
    </option>`).join('');

  return `
    <button type="button" class="admin-master-arrow"
      data-admin-master-page="prev"
      ${currentPage <= 0 ? 'disabled' : ''}
      aria-label="前のページ">◀</button>
    <label class="admin-master-jump" aria-label="ページを選択">
      <select data-admin-master-page-select>${pageOptions}</select>
    </label>
    <button type="button" class="admin-master-arrow"
      data-admin-master-page="next"
      ${currentPage + 1 >= totalPages ? 'disabled' : ''}
      aria-label="次のページ">▶</button>`;
}

function renderAdminVersionHeading() {
  return `
    <div class="admin-version-heading">
      <div>
        <h2 id="adminVersionHeading">バージョン管理</h2>
        <p>表示順の変更と、使用されていない過去バージョンの削除ができます。</p>
      </div>
      <button id="btnRefreshAdminVersions" type="button">再読み込み</button>
    </div>`;
}

export function renderAdminVersionManagerLoading() {
  return `
    <section id="adminVersionManager" class="admin-version-manager" aria-labelledby="adminVersionHeading">
      ${renderAdminVersionHeading()}
      <div class="empty-state">読み込み中...</div>
    </section>`;
}

export function renderAdminVersionList(versions) {
  return `
    ${renderAdminVersionHeading()}
    <div class="admin-version-list">
      ${versions.map((version, index) => `
        <div class="admin-version-row" data-version-id="${escapeHtml(version.id)}">
          <div class="admin-version-info">
            <span class="admin-version-name">${escapeHtml(version.name)}</span>
            ${version.is_current ? '<span class="admin-version-current">現在</span>' : ''}
            ${version.eamusement_slug ? `<small>${escapeHtml(version.eamusement_slug)}</small>` : ''}
          </div>
          <div class="admin-version-actions">
            <button type="button" class="btn-version-up" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-version-down" ${index === versions.length - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-version-delete" ${version.is_current ? 'disabled title="現在のバージョンは削除できません"' : ''}>削除</button>
          </div>
        </div>`).join('')}
    </div>`;
}
