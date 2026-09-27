import { getMySongCommentHistory } from './score-comments.js?v=4_16_6';
import { getFcBadgeMarkup, getOptionBadgeMarkup } from './card-renderer.js?v=4_16_6';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

function renderEmpty(message) {
  return `<div class="song-history-empty">${esc(message)}</div>`;
}

function renderCommentRows(rows) {
  if (!rows.length) return renderEmpty('コメントはありません');
  return `<div class="song-history-list">${rows.map(row => `
    <div class="song-history-row comment-history-row">
      <div class="song-history-version">${esc(row.version_name)}</div>
      <div class="comment-history-text">${esc(String(row.private_comment || '').trim())}</div>
    </div>`).join('')}</div>`;
}

function renderRateRows(rows, currentRate) {
  if (!rows.length) return renderEmpty('過去作の記録はありません');
  return `<div class="song-history-list">${rows.map(row => {
    const rate = row.achievement_rate == null || row.achievement_rate === '' ? NaN : Number(row.achievement_rate);
    const diff = Number.isFinite(rate) && Number.isFinite(currentRate) ? currentRate - rate : NaN;
    const diffMarkup = Number.isFinite(diff)
      ? `<span class="rate-history-diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'}">${diff > 0 ? '+' : ''}${diff.toFixed(2)}%</span>`
      : '';
    return `
      <div class="song-history-row rate-history-row">
        <div class="song-history-version">${esc(row.version_name)}</div>
        <div class="rate-history-values">
          ${getFcBadgeMarkup(row.fc, row.achievement_rate)}
          ${getOptionBadgeMarkup(row.play_option)}
          <span class="rate-history-rate-wrap">
            <strong class="comment-history-rate">${Number.isFinite(rate) ? rate.toFixed(2) + '%' : '—'}</strong>
            ${diffMarkup}
          </span>
        </div>
      </div>`;
  }).join('')}</div>`;
}

function renderDetails(title, rowsMarkup, count) {
  return `
    <details class="song-history-details">
      <summary>
        <span>${esc(title)}</span>
        <span class="song-history-count">${count}</span>
      </summary>
      <div class="song-history-content">${rowsMarkup}</div>
    </details>`;
}

export function createCommentHistory(commentElement, rateElement, fetchHistory = getMySongCommentHistory) {
  let sequence = 0;

  function reset() {
    sequence++;
    commentElement?.replaceChildren();
    rateElement?.replaceChildren();
  }

  async function open(songId, versionId) {
    reset();
    const request = sequence;
    if (commentElement) commentElement.textContent = 'コメント履歴を読み込み中…';
    if (rateElement) rateElement.textContent = '過去作の達成率を読み込み中…';

    try {
      const rows = await fetchHistory(songId, versionId);
      if (request !== sequence) return;

      const commentRows = (rows || []).filter(row =>
        row?.score_id && String(row.private_comment || '').trim()
      );
      const currentRow = (rows || []).find(row =>
        row?.score_id && String(row.version_id) === String(versionId)
      );
      const currentRate = currentRow?.achievement_rate == null || currentRow?.achievement_rate === ''
        ? NaN
        : Number(currentRow.achievement_rate);
      const rateRows = (rows || []).filter(row =>
        row?.score_id && String(row.version_id) !== String(versionId)
      );

      if (commentElement) {
        commentElement.innerHTML = renderDetails(
          'コメント一覧',
          renderCommentRows(commentRows),
          commentRows.length
        );
      }
      if (rateElement) {
        rateElement.innerHTML = renderDetails(
          '過去作の達成率',
          renderRateRows(rateRows, currentRate),
          rateRows.length
        );
      }
    } catch (error) {
      if (request !== sequence) return;
      if (commentElement) commentElement.innerHTML = renderDetails('コメント一覧', renderEmpty('取得できませんでした'), 0);
      if (rateElement) rateElement.innerHTML = renderDetails('過去作の達成率', renderEmpty('取得できませんでした'), 0);
      console.warn('曲コメント・過去作履歴取得失敗:', error);
    }
  }

  return { open, reset };
}
