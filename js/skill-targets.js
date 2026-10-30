// Skill ranking: skill descending, level descending, master official_order ascending.
const titleCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export function compareSkillRows(a, b) {
  const aOrder = a.official_order == null ? Infinity : Number(a.official_order);
  const bOrder = b.official_order == null ? Infinity : Number(b.official_order);
  return Number(b.skill) - Number(a.skill)
    || Number(b.level) - Number(a.level)
    || (aOrder < bOrder ? -1 : aOrder > bOrder ? 1 : 0)
    || titleCollator.compare(String(a.title || ''), String(b.title || ''))
    || String(a.title || '').localeCompare(String(b.title || ''))
    || String(a.part || '').localeCompare(String(b.part || ''))
    || String(a.song_id || a.score_id || '').localeCompare(String(b.song_id || b.score_id || ''));
}

export function selectSkillTargetRows(scores, parts) {
  const bestByTitle = new Map();
  const instrumentPartSet = new Set(parts);

  for (const row of scores) {
    if (!instrumentPartSet.has(String(row.part || ''))) continue;
    if (row.pending_master) continue;
    if (/\(CLASSIC\)\s*$/i.test(String(row.title || ''))) continue;

    const current = bestByTitle.get(row.title);
    if (!current || compareSkillRows(row, current) < 0) {
      bestByTitle.set(row.title, row);
    }
  }

  return Array.from(bestByTitle.values())
    .sort(compareSkillRows);
}

export function calcTargetTotals(targetRows) {
  const sorted = [...targetRows].sort(compareSkillRows);
  const hotRows = sorted.filter(r => r.is_hot).slice(0, 25);
  const otherRows = sorted.filter(r => !r.is_hot).slice(0, 25);

  const hot = hotRows.reduce((sum, row) => sum + Number(row.skill), 0);
  const other = otherRows.reduce((sum, row) => sum + Number(row.skill), 0);

  return { hot, other, total: hot + other, hotRows, otherRows };
}
