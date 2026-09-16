// 曲マスターを表示するための整形処理。管理者向け画面からのみ呼び出す。
export const CATALOG_PARTS = [
  'BSC-D', 'ADV-D', 'EXT-D', 'MAS-D',
  'BSC-G', 'ADV-G', 'EXT-G', 'MAS-G',
  'BSC-B', 'ADV-B', 'EXT-B', 'MAS-B'
];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

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

const partColorClass = part => ({ BSC: 'p-bsc', ADV: 'p-adv', EXT: 'p-ext', MAS: 'p-mas' })[part.slice(0, 3)] || '';

export function renderSongCatalogDetails(song) {
  const sections = [
    ['DM', CATALOG_PARTS.slice(0, 4)],
    ['GF Guitar', CATALOG_PARTS.slice(4, 8)],
    ['GF Bass', CATALOG_PARTS.slice(8, 12)]
  ];
  return `<div class="song-catalog-details-title">${escapeHtml(song.title)}</div>
    <div class="song-catalog-detail-groups">${sections.map(([name, parts]) => `
      <div class="song-catalog-detail-group"><strong>${name}</strong>
        <div class="song-catalog-detail-grid">${parts.map(part => `
          <div><span class="p-badge ${partColorClass(part)}">${part}</span><b>${song.levels?.[part] == null || song.levels[part] === ''
            ? '－' : escapeHtml(Number(song.levels[part]).toFixed(2))}</b></div>`).join('')}</div>
      </div>`).join('')}</div>`;
}
