const ADMIN_SONG_KANA_GROUPS = {
  'あ':'ぁあぃいうぇえぉおゔ',
  'か':'かがきぎくぐけげこご',
  'さ':'さざしじすずせぜそぞ',
  'た':'ただちぢっつづてでとど',
  'な':'なにぬねの',
  'は':'はばぱひびぴふぶぷへべぺほぼぽ',
  'ま':'まみむめも',
  'や':'ゃやゅゆょよ',
  'ら':'らりるれろ',
  'わ':'ゎわゐゑをん'
};

export function adminSongInitialGroup(value) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  if (!normalized) return 'symbol';
  const first = normalized.charAt(0);
  if (/^[a-z]$/i.test(first)) return first.toUpperCase();
  for (const [group, characters] of Object.entries(ADMIN_SONG_KANA_GROUPS)) {
    if (characters.includes(first)) return group;
  }
  return 'symbol';
}

function isKanjiFirstCharacter(value) {
  const first = Array.from(String(value || ''))[0];
  if (!first) return false;
  const codePoint = first.codePointAt(0);
  return (
    (codePoint >= 0x3400 && codePoint <= 0x4DBF) ||
    (codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
    (codePoint >= 0x20000 && codePoint <= 0x2FA1F) ||
    codePoint === 0x3005 ||
    codePoint === 0x3006 ||
    codePoint === 0x3007
  );
}

export function adminSongCategory(row) {
  const reading = String(row?.reading || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();
  if (reading) return adminSongInitialGroup(reading);

  const title = String(row?.title || '').normalize('NFKC').trim();
  if (isKanjiFirstCharacter(title)) return 'unclassified';
  return adminSongInitialGroup(title);
}
