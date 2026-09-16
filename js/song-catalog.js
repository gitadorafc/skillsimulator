// 曲マスターを表示するための整形処理。
export const CATALOG_PARTS = [
  'BSC-D', 'ADV-D', 'EXT-D', 'MAS-D',
  'BSC-G', 'ADV-G', 'EXT-G', 'MAS-G',
  'BSC-B', 'ADV-B', 'EXT-B', 'MAS-B'
];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const INITIAL_GROUPS = ['記号・数字', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'];

// 公開可能なsongsの譜面行を曲単位にまとめ、管理者画面と同じ公式順に並べる。
export function groupSongCatalogRows(rows) {
  const byTitle = new Map();
  for (const row of rows) {
    if (!byTitle.has(row.title)) byTitle.set(row.title, {
      title: row.title, initial_group: '', official_order: null, levels: {}
    });
    const song = byTitle.get(row.title);
    if (row.initial_group && row.initial_group > song.initial_group) song.initial_group = row.initial_group;
    if (row.official_order != null && (song.official_order == null || Number(row.official_order) < song.official_order)) {
      song.official_order = Number(row.official_order);
    }
    song.levels[row.part] = row.level;
  }
  return [...byTitle.values()].sort((a, b) => {
    const rank = group => {
      const index = INITIAL_GROUPS.indexOf(group);
      return index < 0 ? 999 : index;
    };
    return rank(a.initial_group) - rank(b.initial_group)
      || (a.official_order ?? Infinity) - (b.official_order ?? Infinity)
      || a.title.localeCompare(b.title, 'ja');
  });
}

export function buildSongCatalogEntries(songs, mode, direction) {
  const titleCompare = (a, b) => a.title.localeCompare(b.title, 'ja', { numeric: true });
  const multiplier = direction === 'desc' ? -1 : 1;
  // RPCの返却順は頭文字・公式並び順・曲名の順で、管理画面の曲マスターと一致する。
  if (mode === 'title') return (direction === 'desc' ? [...songs].reverse() : songs)
    .map(song => ({ song, title: song.title, part: '', level: null }));

  const parts = mode === 'dm'
    ? CATALOG_PARTS.filter(part => part.endsWith('-D'))
    : CATALOG_PARTS.filter(part => !part.endsWith('-D'));
  return songs.flatMap((song, songOrder) => parts.flatMap(part => {
    const level = song.levels?.[part];
    return level == null || level === '' || !Number.isFinite(Number(level))
      ? [] : [{ song, title: song.title, part, level: Number(level), songOrder }];
  })).sort((a, b) => multiplier * (a.level - b.level) || a.songOrder - b.songOrder || titleCompare(a, b)
    || parts.indexOf(a.part) - parts.indexOf(b.part));
}

export function filterSongCatalogEntries(entries, minLevel = null, maxLevel = null) {
  const min = minLevel == null ? null : Math.round(minLevel * 100);
  const max = maxLevel == null ? null : Math.round(maxLevel * 100);
  return entries.filter(entry => entry.level != null
    && (min == null || Math.round(entry.level * 100) >= min)
    && (max == null || Math.round(entry.level * 100) <= max));
}

const partColorClass = part => ({ BSC: 'p-bsc', ADV: 'p-adv', EXT: 'p-ext', MAS: 'p-mas' })[part.slice(0, 3)] || '';

export function renderSongCatalogDetails(song) {
  const sections = [
    ['DM', CATALOG_PARTS.slice(0, 4)],
    ['GF Guitar', CATALOG_PARTS.slice(4, 8)],
    ['GF Bass', CATALOG_PARTS.slice(8, 12)]
  ];
  return `<table class="song-catalog-detail-table" aria-label="${escapeHtml(song.title)}の難易度">
    <thead><tr><th scope="col"></th>${['BSC', 'ADV', 'EXT', 'MAS'].map(part =>
      `<th scope="col"><span class="p-badge ${partColorClass(part)}">${part}</span></th>`).join('')}</tr></thead>
    <tbody>${sections.map(([name, parts]) => `
      <tr><th scope="row" class="${name === 'DM' ? 'song-catalog-dm' : 'song-catalog-gf'}">${name}</th>${parts.map(part => {
        const level = song.levels?.[part];
        return `<td>${level == null || level === '' || !Number.isFinite(Number(level))
          ? '－' : Number(level).toFixed(2)}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
  </table>`;
}
