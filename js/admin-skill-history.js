// 管理者専用: 一般ユーザー用履歴HTMLへ比較ボタンを混入させない。
import { renderSkillHistoryRows } from './skill-history.js?v=4_40_93';

const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));

export function renderAdminSkillHistoryRows(rows, getTotalSkillRank) {
  const html = renderSkillHistoryRows(rows, getTotalSkillRank);
  if (!rows.length) return html;
  let index = 0;
  return html.replace(/(<button type="button" class="skill-history-delete")/g, match => {
    const row = rows[index++];
    if (!row) return match;
    return `<button type="button" class="skill-history-compare" data-compare-skill-history="${escapeAttribute(row.snapshot_id)}">比較</button>\n      ${match}`;
  }).replace(/class="skill-history-row"/g, 'class="skill-history-row has-compare"');
}
