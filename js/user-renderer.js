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

export function renderAccountSwitchRows(accounts, currentUserId) {
  if (!accounts.length) {
    return '<div class="account-switch-empty">保存済みのユーザーはありません。</div>';
  }

  return accounts.map(account => {
    const isCurrent = account.userId === currentUserId;
    return `
      <div class="account-switch-row${isCurrent ? ' current' : ''}">
        <div>
          <strong>${escapeHtml(account.username)}</strong>
          <small>${isCurrent ? '現在のアカウント' : '切り替え可能'}</small>
        </div>
        <div class="account-switch-actions">
          ${isCurrent ? '' : `<button type="button" class="btn-danger-wide account-switch-remove" data-remove-admin-account="${escapeHtml(account.userId)}">削除</button>`}
          <button type="button" class="app-primary-button" data-switch-admin-account="${escapeHtml(account.userId)}" ${isCurrent ? 'disabled' : ''}>
            ${isCurrent ? '使用中' : '切り替え'}
          </button>
        </div>
      </div>`;
  }).join('');
}

export function renderFeedbackHistoryRows(rows, formatDate) {
  return rows.map(item => {
    const categoryLabel = item.category === 'bug' ? '不具合' : '要望';
    const isDone = item.status === 'resolved';
    const reply = String(item.admin_reply || '').trim();

    return `
      <div class="feedback-history-card">
        <div class="feedback-history-top">
          <span class="feedback-category ${item.category === 'bug' ? 'bug' : 'request'}">${categoryLabel}</span>
          <span class="feedback-history-date">${formatDate(item.created_at)}</span>
        </div>
        <div class="feedback-history-message">${escapeHtml(item.message).replace(/\\n/g, '<br>')}</div>
        ${(item.device_name || item.browser_name) ? `
          <div class="feedback-history-env">
            <strong>ご利用環境</strong><br>
            機種名：${escapeHtml(item.device_name || '未入力')}<br>
            ブラウザ：${escapeHtml(item.browser_name || '未入力')}
          </div>
        ` : ''}
        ${reply ? `
          <div class="feedback-history-reply">
            <div class="feedback-history-reply-label">管理者からの返信</div>
            <div class="feedback-history-reply-message">${escapeHtml(reply).replace(/\\n/g, '<br>')}</div>
          </div>
        ` : ''}
        <div class="feedback-history-status">${reply ? '返信済み' : (isDone ? '対応済み' : '未対応')}</div>
      </div>`;
  }).join('') || '<div class="feedback-history-empty">送信履歴はありません</div>';
}

export function renderFavoriteRows({
  rows,
  instrument,
  getTotalSkillRank,
  formatSkill
}) {
  return rows.map(favorite => {
    const total = Number(favorite.total_skill);
    const hasSkill = Number.isFinite(total);
    const skillClass = hasSkill
      ? `score-rank-${getTotalSkillRank(total)}`
      : '';

    return `
      <div class="favorite-user-row" data-favorite-row="${favorite.favorite_user_id}">
        <button type="button"
          class="favorite-user-open"
          data-favorite-open="${favorite.favorite_user_id}"
          data-favorite-name="${escapeHtml(favorite.username)}"
          data-favorite-view-instrument="${instrument}">
          <span class="name">${escapeHtml(favorite.username)}</span>
          <span class="favorite-user-skill-label">${instrument} TOTAL</span>
          <span class="favorite-user-skill ${skillClass}">${hasSkill ? formatSkill(total) : '-'}</span>
          <span class="favorite-user-arrow">›</span>
        </button>
        <button type="button"
          class="remove"
          data-favorite-remove="${favorite.favorite_user_id}"
          data-favorite-instrument="${instrument}">削除</button>
      </div>`;
  }).join('') || `<div class="section-note">${instrument}ライバルはまだ登録されていません。</div>`;
}
