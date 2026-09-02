const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function renderUserListPager({ totalPages, currentPage }) {
  if (totalPages <= 1) return '';

  const pageOptions = Array.from({ length: totalPages }, (_, index) => `
    <option value="${index}" ${index === currentPage ? 'selected' : ''}>
      ${index + 1} / ${totalPages}
    </option>`).join('');

  return `
    <button type="button" class="user-pager-arrow" data-user-page="prev"
      ${currentPage <= 0 ? 'disabled' : ''} aria-label="前のページ">◀</button>
    <label class="user-pager-jump" aria-label="ページを選択">
      <select data-user-page-select>${pageOptions}</select>
    </label>
    <button type="button" class="user-pager-arrow" data-user-page="next"
      ${currentPage + 1 >= totalPages ? 'disabled' : ''} aria-label="次のページ">▶</button>
  `;
}

export function renderUserListRow({
  user,
  gfSkill,
  dmSkill,
  totalSkill,
  gfClass,
  dmClass,
  totalClass,
  rowRank,
  instrument,
  formatSkill
}) {
  const rivalLabel = `${instrument}ライバル`;

  return `
    <div class="user-list-row user-list-row-${rowRank}" data-user-open="${user.user_id}" data-user-name="${escapeHtml(user.username)}">
      <div class="user-list-name">${escapeHtml(user.username)}${user.is_self ? '（自分）' : ''}</div>
      <div class="user-list-skill user-list-gf"><div class="user-list-skill-value ${gfClass}">${formatSkill(gfSkill)}</div></div>
      <div class="user-list-skill user-list-dm"><div class="user-list-skill-value ${dmClass}">${formatSkill(dmSkill)}</div></div>
      <div class="user-list-skill user-list-total"><span class="user-list-skill-value ${totalClass}">${formatSkill(totalSkill)}</span></div>
      ${user.is_self
        ? '<div></div>'
        : `<button class="favorite-toggle ${user.is_favorite ? 'active' : ''}"
            data-favorite-user="${user.user_id}"
            data-favorite-instrument="${instrument}"
            title="${rivalLabel}">${user.is_favorite ? '★' : '☆'}</button>`}
    </div>`;
}

export function renderUserDetailSkillSections({ hotCards, otherCards }) {
  return `
    <div class="sk-section skill-hot-section"><h2>HOT Top25</h2><div class="list-container">
      ${hotCards || '<div class="empty-state">記録がありません</div>'}
    </div></div>
    <div class="sk-section skill-other-section"><h2>OTHER Top25</h2><div class="list-container">
      ${otherCards || '<div class="empty-state">記録がありません</div>'}
    </div></div>`;
}

export function renderUserDetailRegisteredSection({
  totalCount,
  visibleCount,
  cards,
  hasMore
}) {
  return `
    <div class="sk-section">
      <h2>登録曲 ${totalCount}件（${visibleCount}件表示）</h2>
      <div class="list-container">
        ${cards || '<div class="empty-state">登録曲がありません</div>'}
      </div>
      ${hasMore ? `
        <div class="user-detail-records-more">
          <span>${visibleCount} / ${totalCount}件表示</span>
          <button type="button" data-user-detail-records-more>もっと見る</button>
        </div>` : ''}
    </div>`;
}
