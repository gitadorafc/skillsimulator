const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function renderSkillRankingRangeOptions(side) {
  const isMaximum = side === 'max';
  return Array.from({ length: 100 }, (_, index) => {
    const value = (index + (isMaximum ? 1 : 0)) * 100;
    return `<option value="${value}">${value}</option>`;
  }).join('');
}

function titleCompare(a, b) {
  return String(a.title || '').localeCompare(String(b.title || ''), 'ja', {
    numeric: true,
    sensitivity: 'base'
  }) || String(a.part || '').localeCompare(String(b.part || ''), 'ja');
}

export function sortSkillRankingRows(rows, sortKey) {
  const sorted = [...rows];
  const percentageTie = (a, b) =>
    Number(b.inclusion_percentage) - Number(a.inclusion_percentage)
    || Number(b.average_skill) - Number(a.average_skill)
    || titleCompare(a, b);

  if (sortKey === 'title') {
    return sorted.sort((a, b) => titleCompare(a, b));
  }
  if (sortKey === 'average') {
    return sorted.sort((a, b) =>
      Number(b.average_skill) - Number(a.average_skill)
      || percentageTie(a, b)
    );
  }
  if (sortKey === 'comparison') {
    return sorted.sort((a, b) => {
      const aMissing = a.comparison == null;
      const bMissing = b.comparison == null;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing) {
        const difference = Number(b.comparison) - Number(a.comparison);
        if (difference) return difference;
      }
      return percentageTie(a, b);
    });
  }
  return sorted.sort(percentageTie);
}

function formatComparison(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return { text: '比較なし', className: 'neutral' };
  }
  const number = Number(value);
  if (number > 0) return { text: `+${number.toFixed(2)}`, className: 'positive' };
  if (number < 0) return { text: number.toFixed(2), className: 'negative' };
  return { text: '±0.00', className: 'neutral' };
}

export function renderSkillRankingRows(rows, getPartColorClass) {
  return rows.map((row, index) => {
    const ownSkill = row.my_skill == null ? null : Number(row.my_skill);
    const comparison = formatComparison(row.comparison);
    return `
      <div class="skill-ranking-row">
        <div class="skill-ranking-row-top">
          <span class="skill-ranking-position">#${index + 1}</span>
          <span class="skill-ranking-song" title="${escapeHtml(row.title)}">${escapeHtml(row.title)}</span>
          <span class="p-badge ${getPartColorClass(row.part)}">${escapeHtml(row.part)}</span>
          <span class="skill-ranking-level">Lv${Number(row.level).toFixed(2)}</span>
        </div>
        <div class="skill-ranking-metrics">
          <div class="skill-ranking-metric">
            <small>対象入り割合</small>
            <strong>${Number(row.inclusion_percentage).toFixed(2)}%</strong>
            <em>${Number(row.target_user_count)} / ${Number(row.eligible_user_count)}人</em>
          </div>
          <div class="skill-ranking-metric">
            <small>スキル値平均</small>
            <strong>${Number(row.average_skill).toFixed(2)}</strong>
            <em>対象入りユーザー平均</em>
          </div>
          <div class="skill-ranking-metric">
            <small>平均との比較</small>
            <strong>${ownSkill == null ? '未登録' : ownSkill.toFixed(2)}</strong>
            <em class="skill-ranking-comparison ${comparison.className}">${comparison.text}</em>
          </div>
        </div>
      </div>`;
  }).join('');
}
