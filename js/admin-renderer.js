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

export function renderAdminRequestList({ requests, parts, formatLevel }) {
  return requests.map(request => `
    <div class="admin-card">
      <div class="admin-card-top">
        ${request.request_type === 'level_correction'
          ? `<div class="admin-card-title">${escapeHtml(request.title)}</div>`
          : `<div class="admin-request-title-wrap">
              <label for="requestTitle_${request.id}">承認する曲名（修正可）</label>
              <input id="requestTitle_${request.id}"
                class="request-title-edit"
                type="text"
                autocomplete="off"
                maxlength="255"
                value="${escapeHtml(request.title)}">
             </div>`}
        <span class="pending-badge">${request.request_type === 'level_correction' ? '難易度修正' : '新規曲'}</span>
      </div>
      <div class="admin-card-meta">
        <span>依頼パート: ${escapeHtml(request.part)}</span>
        ${request.request_type === 'level_correction' ? `<span>現在: ${formatLevel(request.current_level)}</span>` : ''}
        <span>依頼者: ${escapeHtml(request.profiles?.username || '-')}</span>
        <span>${new Date(request.created_at).toLocaleString('ja-JP')}</span>
      </div>
      <div class="request-edit-fields">
        ${request.request_type === 'new_song' ? `
          <div class="request-edit-field">
            <label for="requestPart_${request.id}">承認するパート（修正可）</label>
            <select id="requestPart_${request.id}" class="request-part-edit">
              ${parts.map(part => `<option value="${part}"${part === request.part ? ' selected' : ''}>${part}</option>`).join('')}
            </select>
          </div>` : ''}
        <div class="request-edit-field">
          <label for="requestLevel_${request.id}">承認する難易度（修正可）</label>
          <input
            id="requestLevel_${request.id}"
            class="request-level-edit"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            value="${formatLevel(request.proposed_level)}">
        </div>
      </div>
      <div class="request-actions">
        <button class="request-approve" data-admin-approve-request="${request.id}">修正して承認</button>
        <button class="request-hot" data-admin-hot-request="${request.id}">HOTで承認</button>
        <button class="request-reject" data-admin-reject-request="${request.id}">却下</button>
      </div>
    </div>`).join('') || '<div class="empty-state">未処理の登録依頼はありません</div>';
}

export function renderAdminUserList({ users, formatDate }) {
  return `
    <div class="admin-activity-legend">
      <b>アクティブ度</b>
      <span>S：7日連続更新</span><span>A：7日連続アクセス</span>
      <span>B：更新＋通常利用</span><span>C：更新のみ</span>
      <span>D：登録後に利用</span><span>E：登録のみ</span>
    </div>
    ${users.map(user => `
    <div class="admin-card">
      <div class="admin-card-top">
        <div class="admin-card-user-heading">
          <span class="admin-activity-badge level-${String(user.activity_level || 'E').toLowerCase()}">${escapeHtml(user.activity_level || 'E')}</span>
          <div class="admin-card-title">${escapeHtml(user.username)}</div>
        </div>
        <div class="admin-actions">
          <button class="admin-edit" data-user-open="${user.id}" data-user-name="${escapeHtml(user.username)}">詳細</button>
          <button class="admin-reset" data-admin-reset-user="${user.id}">PW変更</button>
          <button class="admin-delete" data-admin-delete-user="${user.id}">削除</button>
        </div>
      </div>
      <div class="admin-card-meta">
        <span><b>登録日時</b> ${formatDate(user.created_at)}</span>
        <span><b>最終ログイン日時</b> ${formatDate(user.last_sign_in_at)}</span>
        <span><b>最終アクセス</b> ${formatDate(user.last_open_at)}</span>
        <span><b>最終更新</b> ${formatDate(user.last_update_at)}</span>
        <span><b>直近7日</b> アクセス ${Number(user.open_days_7) || 0}日 / 更新 ${Number(user.update_days_7) || 0}日</span>
      </div>
    </div>`).join('') || '<div class="empty-state">該当するユーザーがいません</div>'}`;
}
