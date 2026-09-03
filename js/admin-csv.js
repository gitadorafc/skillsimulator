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

const VALID_INITIAL_GROUPS = new Set([
  '記号・数字',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'あ行','か行','さ行','た行','な行',
  'は行','ま行','や行','ら行','わ行'
]);

function normalizeDuplicateOrders(rows) {
  const byInitial = new Map();
  rows.forEach(row => {
    if (row.initialGroup == null || row.officialOrder == null) return;
    if (!byInitial.has(row.initialGroup)) byInitial.set(row.initialGroup, []);
    byInitial.get(row.initialGroup).push(row);
  });

  byInitial.forEach(groupRows => {
    for (let start = 0; start < groupRows.length;) {
      let end = start + 1;
      while (
        end < groupRows.length &&
        groupRows[end].officialOrder === groupRows[start].officialOrder
      ) end += 1;

      const duplicateCount = end - start;
      if (duplicateCount > 1) {
        const base = groupRows[start].officialOrder;
        const next = end < groupRows.length && groupRows[end].officialOrder > base
          ? groupRows[end].officialOrder
          : base + 1;
        const step = (next - base) / duplicateCount;
        for (let offset = 1; offset < duplicateCount; offset += 1) {
          groupRows[start + offset].officialOrder = Number(
            (base + step * offset).toFixed(4)
          );
        }
      }
      start = end;
    }
  });
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
  const initialColumn = findColumn('頭文字', 'INITIAL_GROUP');
  const orderColumn = findColumn('並び順', '公式並び順', 'OFFICIAL_ORDER', 'SORT_ORDER');
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
    const title = titleRaw || null;
    const initialRaw = valueAt(initialColumn);
    const initialGroup = initialRaw || null;
    if (initialGroup && !VALID_INITIAL_GROUPS.has(initialGroup)) {
      throw new Error(`${rowNumber}行目の頭文字が不正です。`);
    }
    const orderRaw = valueAt(orderColumn).replace(/,/g, '');
    const officialOrder = orderRaw === '' ? null : Number(orderRaw);
    if (officialOrder != null && (!Number.isFinite(officialOrder) || officialOrder < 0)) {
      throw new Error(`${rowNumber}行目の並び順は0以上の数値で入力してください。`);
    }
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
      initialGroup,
      officialOrder,
      isHot,
      levels
    });
  });

  if (!parsed.length) throw new Error('CSVに登録データがありません。');
  normalizeDuplicateOrders(parsed);
  return parsed;
}
