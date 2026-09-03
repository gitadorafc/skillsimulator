export function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function parseCsvTable(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const table = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      table.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSVの引用符が閉じられていません。');
  if (field !== '' || row.length) {
    row.push(field);
    table.push(row);
  }

  return table.filter(cells => cells.some(value => String(value || '').trim() !== ''));
}

function normalizeCsvHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toUpperCase();
}

function parseCsvBoolean(value, label, rowNumber) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  if (['1', 'TRUE', 'YES', 'Y', 'ON', '○', '〇', '済', 'HOT'].includes(normalized)) return true;
  if (['0', 'FALSE', 'NO', 'N', 'OFF', '×', '未', 'OTHER'].includes(normalized)) return false;
  throw new Error(`${rowNumber}行目の${label}は 1 または 0 で入力してください。`);
}

export function parseMasterCsv(text, parts) {
  const table = parseCsvTable(text);
  if (table.length < 2) throw new Error('CSVに登録データがありません。');

  const headers = table[0].map(normalizeCsvHeader);
  const findColumn = (...names) => {
    const normalized = names.map(normalizeCsvHeader);
    return headers.findIndex(header => normalized.includes(header));
  };

  const idColumn = findColumn('曲ID', 'SONG_ID', 'ID');
  const titleColumn = findColumn('曲名', 'TITLE');
  const readingColumn = findColumn('ふりがな', 'READING');
  const readingSourceColumn = findColumn('ふりがな種別', 'READING_SOURCE');
  const readingReviewedColumn = findColumn('ふりがな確認済み', 'READING_REVIEWED');
  const hotColumn = findColumn('HOT', '種別');
  const partColumns = new Map(parts.map(part => [part, findColumn(part)]));

  if (idColumn < 0) throw new Error('「曲ID」列がありません。');
  if (titleColumn < 0 && !parts.some(part => partColumns.get(part) >= 0)) {
    throw new Error('「曲名」または難易度列がありません。');
  }

  const parsed = [];
  const usedIds = new Set();
  const newTitles = new Set();

  table.slice(1).forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const valueAt = column => column >= 0 ? String(cells[column] ?? '').trim() : '';
    const songId = valueAt(idColumn);
    const titleRaw = valueAt(titleColumn);
    const readingRaw = valueAt(readingColumn);
    const readingSourceRaw = valueAt(readingSourceColumn).toUpperCase();
    const title = titleRaw || null;
    const reading = readingRaw || null;
    const readingSource = readingSourceRaw || null;
    const readingReviewed = readingReviewedColumn >= 0
      ? parseCsvBoolean(valueAt(readingReviewedColumn), 'ふりがな確認済み', rowNumber)
      : null;
    const isHot = hotColumn >= 0
      ? parseCsvBoolean(valueAt(hotColumn), 'HOT', rowNumber)
      : null;
    const levels = {};
    let hasLevelChange = false;

    parts.forEach(part => {
      const column = partColumns.get(part);
      if (column < 0) {
        levels[part] = null;
        return;
      }

      const raw = valueAt(column);
      if (!raw) {
        levels[part] = null;
        return;
      }
      if (['削除', 'DELETE'].includes(raw.toUpperCase())) {
        levels[part] = '';
        hasLevelChange = true;
        return;
      }

      const numeric = Number(raw);
      if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 9.99) {
        throw new Error(`${rowNumber}行目の${part}は0.01～9.99で入力してください。`);
      }
      levels[part] = numeric.toFixed(2);
      hasLevelChange = true;
    });

    if (!songId && !title) {
      throw new Error(`${rowNumber}行目は曲IDまたは曲名が必要です。`);
    }
    if (!songId && !hasLevelChange) {
      throw new Error(`${rowNumber}行目の新規曲には最低1つの難易度が必要です。`);
    }
    if (songId && usedIds.has(songId)) {
      throw new Error(`${rowNumber}行目の曲IDが重複しています。`);
    }
    if (!songId && newTitles.has(title)) {
      throw new Error(`${rowNumber}行目の新規曲名が重複しています。`);
    }
    if (songId) usedIds.add(songId);
    else newTitles.add(title);

    parsed.push({
      rowNumber,
      songId,
      title,
      reading,
      readingSource,
      readingReviewed,
      isHot,
      levels
    });
  });

  if (!parsed.length) throw new Error('CSVに登録データがありません。');
  return parsed;
}
