const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function formatSkillHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function serializeSkillHistoryRow(row) {
  return {
    title: String(row?.title || ''),
    part: String(row?.part || ''),
    level: Number(row?.level) || 0,
    achievement_rate: Number(row?.achievement_rate) || 0,
    skill: Number(row?.skill) || 0,
    fc: row?.fc ? String(row.fc) : null,
    play_option: String(row?.play_option || 'NORMAL'),
    is_hot: Boolean(row?.is_hot)
  };
}

export function renderSkillHistoryRows(rows, getTotalSkillRank) {
  if (!rows.length) {
    return '<div class="skill-history-empty">保存した履歴はありません。</div>';
  }

  return rows.map(row => `
    <div class="skill-history-row has-compare">
      <div class="skill-history-summary">
        <span class="skill-history-date">${escapeHtml(formatSkillHistoryDate(row.saved_at))}</span>
        <strong class="skill-history-value score-rank-${getTotalSkillRank(row.total_skill)}">${Number(row.total_skill).toFixed(2)}</strong>
      </div>
      <button type="button" class="skill-history-display" data-open-skill-history="${escapeHtml(row.snapshot_id)}">表示</button>
      <button type="button" class="skill-history-compare" data-compare-skill-history="${escapeHtml(row.snapshot_id)}">比較</button>
      <button type="button" class="skill-history-delete" data-delete-skill-history="${escapeHtml(row.snapshot_id)}">削除</button>
    </div>
  `).join('');
}
