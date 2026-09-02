const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function renderAdminCsvVersionOptions(versions) {
  return [
    ...versions.map(version => `
      <option value="${version.id}">
        ${escapeHtml(version.name)}${version.is_current ? '（最新版）' : ''}
      </option>`),
    '<option value="__NEW__">＋ 新しいバージョンを追加</option>'
  ].join('');
}

export function renderAdminSongPickerOptions(rows) {
  return `
    <option value="">選択してください（${rows.length}曲）</option>
    ${rows.map(row => `<option value="${escapeHtml(row.title)}">${escapeHtml(row.title)}</option>`).join('')}`;
}

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

export function renderAdminMasterTable({
  rows,
  totalCount,
  totalPages,
  currentPage,
  parts,
  newSongRowVisible,
  formatLevel
}) {
  return `
    <div class="admin-master-summary">
      <span>${totalCount.toLocaleString('ja-JP')}曲</span>
      <span>${currentPage + 1} / ${totalPages}ページ</span>
    </div>
    <div class="master-sheet-wrap">
      <table class="master-sheet" id="adminMasterTable">
        <thead>
          <tr>
            <th class="master-hot-cell">HOT</th>
            <th class="master-title-cell">曲名</th>
            <th class="master-reading-cell">ふりがな</th>
            <th class="master-reading-review-cell">確認</th>
            ${parts.map(part => `<th class="master-level-cell">${part}</th>`).join('')}
            <th class="master-action-cell">操作</th>
          </tr>
        </thead>
        <tbody>
          ${newSongRowVisible ? `
            <tr class="master-new-row" data-master-new-row>
              <td class="master-hot-cell">
                <input type="checkbox" data-master-hot>
              </td>
              <td class="master-title-cell">
                <input type="text" data-master-title value="" placeholder="曲名">
              </td>
              <td class="master-reading-cell">
                <input type="text" data-master-reading value="" placeholder="漢字曲など">
              </td>
              <td class="master-reading-review-cell">
                <input type="checkbox" data-master-reading-reviewed aria-label="ふりがな確認済み">
              </td>
              ${parts.map(part => `
                <td class="master-level-cell">
                  <input
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    data-master-level="${part}"
                    value=""
                    placeholder="-">
                </td>`).join('')}
              <td class="master-action-cell">
                <div class="master-row-actions">
                  <button class="master-row-save" data-admin-register-master-row>登録</button>
                  <button class="master-row-delete" data-admin-cancel-master-row>キャンセル</button>
                </div>
              </td>
            </tr>` : ''}
          ${rows.map((row, index) => `
            <tr data-master-row="${index}"
              data-original-title="${escapeHtml(row.title)}"
              data-original-reading="${escapeHtml(row.reading || '')}"
              data-reading-source="${escapeHtml(row.reading_source || 'NONE')}">
              <td class="master-hot-cell">
                <input type="checkbox" data-master-hot ${row.is_hot ? 'checked' : ''}>
              </td>
              <td class="master-title-cell">
                <input type="text" data-master-title value="${escapeHtml(row.title)}">
              </td>
              <td class="master-reading-cell">
                <input type="text" data-master-reading value="${escapeHtml(row.reading || '')}" placeholder="漢字曲など">
              </td>
              <td class="master-reading-review-cell" title="${row.reading_source === 'AUTO' ? '自動付与' : row.reading_source === 'MANUAL' ? '手動入力' : '曲名と同一'}">
                <input type="checkbox" data-master-reading-reviewed
                  aria-label="ふりがな確認済み"
                  ${row.reading_reviewed ? 'checked' : ''}>
              </td>
              ${parts.map(part => `
                <td class="master-level-cell">
                  <input
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    data-master-level="${part}"
                    value="${row.levels?.[part] != null ? formatLevel(row.levels[part]) : ''}"
                    placeholder="-">
                </td>`).join('')}
              <td class="master-action-cell">
                <div class="master-row-actions">
                  <button class="master-row-save" data-admin-save-master-row="${index}">保存</button>
                  <button class="master-row-delete" data-admin-delete-master-row="${index}">削除</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="admin-master-pager">
      ${renderAdminMasterPager({ totalPages, currentPage })}
    </div>`;
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

function renderAdminUsageCard({ label, row, trackedCount }) {
  return `
    <div class="admin-usage-card">
      <span>${escapeHtml(label)}</span>
      <strong>${Number(row?.usage_rate || 0).toFixed(1)}%</strong>
      <small>${Number(row?.enabled_count || 0).toLocaleString('ja-JP')} / ${trackedCount.toLocaleString('ja-JP')}人</small>
    </div>`;
}

export function renderAdminSettingUsage({
  trackedCount,
  totalUsers,
  booleanRows,
  optionRows
}) {
  const optionLabels = {
    NORMAL: '正規',
    RAN: 'RAN',
    SRA: 'SRA',
    'RAN+': 'RAN+',
    'SRA+': 'SRA+'
  };

  return `
    <div class="admin-usage-summary">
      <div>
        <strong>設定移行済み ${trackedCount.toLocaleString('ja-JP')} / ${totalUsers.toLocaleString('ja-JP')}人</strong>
        <small>更新版を開いたユーザーから順次集計されます。</small>
      </div>
      <button id="btnRefreshAdminSettingUsage" type="button">再読み込み</button>
    </div>
    <div class="admin-usage-section-title">表示設定</div>
    <div class="admin-usage-grid">
      ${booleanRows.map(row => renderAdminUsageCard({
        label: row.setting_label,
        row,
        trackedCount
      })).join('')}
    </div>
    <div class="admin-usage-section-title">GFのデフォルトオプション</div>
    <div class="admin-usage-grid admin-usage-options">
      ${optionRows.map(row => renderAdminUsageCard({
        label: optionLabels[row.option_value] || row.option_value,
        row,
        trackedCount
      })).join('')}
    </div>`;
}

export function renderAdminFeedbackList({ items, getUsername, formatDate }) {
  return items.map(item => {
    const isDone = item.status === 'resolved';
    const categoryLabel = item.category === 'bug' ? '不具合' : '要望';
    return `
      <div class="admin-card feedback-admin-card ${isDone ? 'resolved' : ''}">
        <div class="admin-card-top">
          <div class="admin-card-title">
            <span class="feedback-category ${item.category === 'bug' ? 'bug' : 'request'}">${categoryLabel}</span>
            ${escapeHtml(getUsername(item.user_id) || 'ユーザー')}
          </div>
          <div class="admin-actions">
            <button
              class="${isDone ? 'admin-reset' : 'admin-edit'}"
              data-admin-feedback-status="${item.id}"
              data-feedback-next-status="${isDone ? 'new' : 'resolved'}">
              ${isDone ? '未対応に戻す' : '対応済みにする'}
            </button>
            <button
              class="admin-delete"
              data-admin-feedback-delete="${item.id}">
              削除
            </button>
          </div>
        </div>
        <div class="feedback-admin-message">${escapeHtml(item.message).replace(/\\n/g, '<br>')}</div>
        ${(item.device_name || item.browser_name) ? `
          <div class="feedback-admin-env">
            <strong>ご利用環境</strong><br>
            機種名：${escapeHtml(item.device_name || '未入力')}<br>
            ブラウザ：${escapeHtml(item.browser_name || '未入力')}
          </div>
        ` : ''}

        ${item.admin_reply ? `
          <div class="feedback-admin-replied">
            <strong>返信済み</strong>
            ${escapeHtml(item.admin_reply).replace(/\\n/g, '<br>')}
            ${item.replied_at ? `<div class="admin-card-meta" style="margin-top:5px;">${formatDate(item.replied_at)}</div>` : ''}
          </div>
        ` : `
          <div class="feedback-admin-reply-box">
            <div class="feedback-admin-reply-label">ユーザーへ返信（1回のみ）</div>
            <textarea
              maxlength="2000"
              data-admin-feedback-reply-input="${item.id}"
              placeholder="返信内容を入力してください"></textarea>
            <div class="feedback-admin-reply-actions">
              <button data-admin-feedback-reply="${item.id}">返信する</button>
            </div>
          </div>
        `}

        <div class="admin-card-meta">
          <span>${formatDate(item.created_at)}</span>
          <span>${item.admin_reply ? '返信済み' : (isDone ? '対応済み' : '未対応')}</span>
        </div>
      </div>`;
  }).join('') || '<div class="empty-state">要望・不具合報告はありません</div>';
}
