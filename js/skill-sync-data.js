export function buildSkillSyncBookmarklet() {
  // 同期本体は外部JS側。ブックマークレットは読み込みだけにして最短化する。
  return "javascript:void(!function(d){var s=d.createElement('script');s.src='https://gitadorafc.github.io/skillsimulator/js/eamusement-sync.js?t='+Date.now();d.head.appendChild(s)}(document))";
}

export function normalizeSkillSyncRecords(records, parts, normalizeTitle) {
  const unique = new Map();

  for (const row of records) {
    const title = String(row?.title || '').trim();
    const part = String(row?.part || '');
    const rate = Number(row?.rate);
    const level = Number(row?.level);
    const category = String(row?.category || '').toUpperCase() === 'HOT' ? 'HOT' : 'OTHER';

    if (!title || !parts.includes(part)) continue;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) continue;
    if (!Number.isFinite(level) || level <= 0 || level > 99.99) continue;

    unique.set(`${normalizeTitle(title)}\u0000${part}`, {
      title,
      part,
      // 公式ページの表示値は小数第2位まで確定済み。
      // Math.floorでは80.71が浮動小数誤差で80.70になるため、表示桁へ正規化する。
      rate: Number(rate.toFixed(2)),
      level: Number(level.toFixed(2)),
      category
    });
  }

  return [...unique.values()];
}

export function formatSkillSyncCountText(counts, rowCount) {
  return counts
    ? `GF HOT ${counts.GF_HOT ?? 0} / GF OTHER ${counts.GF_OTHER ?? 0} / DM HOT ${counts.DM_HOT ?? 0} / DM OTHER ${counts.DM_OTHER ?? 0}`
    : `${rowCount}件`;
}
