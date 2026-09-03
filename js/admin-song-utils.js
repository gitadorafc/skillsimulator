const INITIAL_FILTER_VALUES = new Map([
  ['記号・数字', 'symbol'],
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(value => [value, value]),
  ['あ行', 'あ'],
  ['か行', 'か'],
  ['さ行', 'さ'],
  ['た行', 'た'],
  ['な行', 'な'],
  ['は行', 'は'],
  ['ま行', 'ま'],
  ['や行', 'や'],
  ['ら行', 'ら'],
  ['わ行', 'わ']
]);

export function adminSongCategory(row) {
  const initialGroup = String(
    row?.initialGroup ?? row?.initial_group ?? ''
  ).trim();
  return INITIAL_FILTER_VALUES.get(initialGroup) || '';
}
