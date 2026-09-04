import { getMySongCommentHistory } from './score-comments.js?v=4_16_0';
import { getFcBadgeMarkup, getOptionBadgeMarkup } from './card-renderer.js?v=4_14_34';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

export function renderCommentRecord(row) {
  if (!row?.score_id) return '<span class="comment-history-empty">記録なし</span>';
  const rate = Number(row.achievement_rate);
  return `
    ${getFcBadgeMarkup(row.fc, row.achievement_rate)}
    ${getOptionBadgeMarkup(row.play_option)}
    <strong class="comment-history-rate">${Number.isFinite(rate) ? rate.toFixed(2) + '%' : '—'}</strong>
    <span class="comment-history-text">${esc(String(row.private_comment || '').trim() || 'なし')}</span>`;
}

export function createCommentHistory(element, fetchHistory = getMySongCommentHistory) {
  let sequence = 0;
  let rows = [];
  element.addEventListener('change', event => {
    if (event.target.id !== 'commentHistoryVersion') return;
    const row = rows.find(item => item.version_id === event.target.value);
    element.querySelector('.comment-history-record').innerHTML = renderCommentRecord(row);
  });
  function reset() {
    sequence++;
    rows = [];
    element.replaceChildren();
  }
  async function open(songId, versionId) {
    reset();
    const request = sequence;
    element.textContent = 'コメント一覧を読み込み中…';
    try {
      const data = await fetchHistory(songId, versionId);
      if (request !== sequence) return;
      rows = data;
      if (!rows.length) throw new Error('バージョン情報がありません。');
      const selected = rows.find(row => row.version_id === versionId) || rows[0];
      element.innerHTML = `
        <div class="comment-history-heading">
          <label for="commentHistoryVersion">コメント一覧</label>
          <select id="commentHistoryVersion" aria-label="コメントのバージョン">
            ${rows.map(row => `<option value="${esc(row.version_id)}"${row.version_id === selected.version_id ? ' selected' : ''}>${esc(row.version_name)}</option>`).join('')}
          </select>
        </div>
        <div class="comment-history-record" aria-live="polite">${renderCommentRecord(selected)}</div>`;
    } catch (error) {
      if (request !== sequence) return;
      element.textContent = 'コメント一覧を取得できませんでした。再度開いてください。';
      console.warn('曲コメント履歴取得失敗:', error);
    }
  }
  return { open, reset };
}

