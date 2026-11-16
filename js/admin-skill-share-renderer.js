import {
  getSkillColorRowByTotalValue,
  skillColorCanvasVerticalPaint,
  skillColorCanvasShareTextPaint,
  drawSkillColorCanvasSparkle,
  drawShareTotalSparkles
} from './skill-colors.js?v=4_14_33';
import { formatSkillHistoryDate } from './skill-history.js?v=4_14_45';
import { normalizeSongTitleForMatch } from './songs.js?v=4_15_6';

/* Admin-only image format. The public image renderer above is deliberately
   unchanged. Layout is shared by normal and comparison exports. */
export async function renderAdminJacketSkillShareFile({
  instrument, snapshot = null, comparisonBaseline = null, currentTotals,
  currentVersionName = '', username = '', getJacketUrls = () => [], getMedalSvg = () => ''
}) {
  const validSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
  const target = validSnapshot || currentTotals;
  const isComparison = Boolean(comparisonBaseline);
  // Match exact charts first, then match a replaced part within the same
  // song. Consume baseline rows at most once; HOT/OTHER moves are not NEW.
  const songKey = row => normalizeSongTitleForMatch(String(row?.title || ''));
  const chartKey = row => `${songKey(row)}\u0000${String(row?.part || '').toUpperCase()}`;
  const oldRows = [...(comparisonBaseline?.hotRows || []), ...(comparisonBaseline?.otherRows || [])];
  const currentRows = [
    ...(target.hotRows || []).slice(0, 25).map(row => ({row, section:'HOT'})),
    ...(target.otherRows || []).slice(0, 25).map(row => ({row, section:'OTHER'}))
  ];
  const consumed = new Set();
  const matches = new Map();
  // Exact matches have priority over cross-part matches, regardless of order.
  currentRows.forEach(({row}) => {
    const oldIndex = oldRows.findIndex((old, i) => !consumed.has(i) && chartKey(old) === chartKey(row));
    if (oldIndex >= 0) { consumed.add(oldIndex); matches.set(row, oldRows[oldIndex]); }
  });
  currentRows.forEach(({row}) => {
    if (matches.has(row)) return;
    const oldIndex = oldRows.findIndex((old, i) => !consumed.has(i) && songKey(old) === songKey(row));
    if (oldIndex >= 0) { consumed.add(oldIndex); matches.set(row, oldRows[oldIndex]); }
  });
  const comparisonRows = isComparison ? currentRows
    .filter(({row}) => {
      const old = matches.get(row);
      return !old || Number(row.skill || 0) - Number(old.skill || 0) >= .005;
    })
    .sort((a, b) => {
      const skillDiff = Number(b.row?.skill || 0) - Number(a.row?.skill || 0);
      if (Math.abs(skillDiff) > .0001) return skillDiff;
      const rateDiff = Number(b.row?.achievement_rate || 0) - Number(a.row?.achievement_rate || 0);
      if (Math.abs(rateDiff) > .0001) return rateDiff;
      return Number(b.row?.level || 0) - Number(a.row?.level || 0);
    }) : [];
  const hotRows = (target.hotRows || []).slice(0, 25);
  const otherRows = (target.otherRows || []).slice(0, 25);
  const tableTop = isComparison ? 350 : 256;
  const H = isComparison ? Math.max(580, tableTop + 52 + Math.max(comparisonRows.length, 1) * 154 + 96) : 2180;
  const W = isComparison ? 1160 : 1400;
  const rowH = 70;
  // Export at higher pixel density so small jackets, labels and medal artwork
  // remain sharp when viewing the full saved PNG. Logical layout is unchanged.
  const exportScale = 1.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * exportScale);
  canvas.height = Math.round(H * exportScale);
  const ctx = canvas.getContext('2d');
  ctx.scale(exportScale, exportScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const c = ctx;

  // The same jacket candidates as the admin registered-song cards, with a
  // fallback for records without artwork or cross-origin canvas permissions.
  const titles = [...new Set([...hotRows, ...otherRows]
    .map(row => String(row.title || '')))];
  const jacketMap = new Map();
  await Promise.all(titles.map(async title => {
    for (const url of getJacketUrls(title) || []) {
      try {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          const timer = setTimeout(() => { image.src = ''; reject(new Error('jacket timeout')); }, 3500);
          image.onload = () => { clearTimeout(timer); resolve(image); };
          image.onerror = () => { clearTimeout(timer); reject(new Error('jacket unavailable')); };
          image.src = url;
        });
        jacketMap.set(title, img);
        break;
      } catch (_) { /* try the next image or draw the default square */ }
    }
  }));

  // Render the exact same SVG medal that admin cards use, not an imitation.
  // Each icon is loaded once and reused throughout both generated tables.
  const medalImages = new Map();
  await Promise.all(['EXC', 'FC'].map(async type => {
    const svg = getMedalSvg(type);
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml;charset=utf-8'}));
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('medal SVG load failed'));
        image.src = url;
      });
      medalImages.set(type, img);
    } catch (error) { console.warn('[admin share] medal SVG unavailable:', error); }
    finally { URL.revokeObjectURL(url); }
  }));

  c.fillStyle = '#07101d'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#0f1a2d'; c.fillRect(28, 28, W - 56, H - 56);
  c.fillStyle = '#f8fafc'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.font = '900 42px sans-serif';
  c.fillText(instrument === 'GF' ? 'GITADORA GuitarFreaks Skill' : 'GITADORA DrumMania Skill', 54, 82);
  c.fillStyle = '#94a3b8'; c.font = '700 24px sans-serif';
  c.fillText(validSnapshot?.versionName || currentVersionName, 54, 118);

  const name = String(validSnapshot?.username || username || 'USER').trim() || 'USER';
  const total = Number(target.total || 0);
  const totalText = total.toFixed(2);
  c.font = '900 42px sans-serif';
  let clippedName = name;
  while (c.measureText(clippedName).width > 700 && clippedName.length > 2) clippedName = clippedName.slice(0, -1);
  if (clippedName !== name) clippedName = clippedName.slice(0, -1) + '…';
  const nameW = c.measureText(clippedName).width;
  const totalX = 54 + nameW + 28;
  const totalW = c.measureText(totalText).width;
  const totalRow = getSkillColorRowByTotalValue(total);
  c.fillStyle = skillColorCanvasShareTextPaint(c, totalRow, 54, 132, nameW, 52);
  c.fillText(clippedName, 54, 174);
  c.fillStyle = skillColorCanvasShareTextPaint(c, totalRow, totalX, 132, totalW, 52);
  c.fillText(totalText, totalX, 174);
  drawShareTotalSparkles(c, totalRow, 54, nameW, totalX, totalW, 132, 52);
  c.fillStyle = '#94a3b8'; c.font = '800 26px sans-serif';
  c.fillText(`HOT ${Number(target.hot || 0).toFixed(2)}   OTHER ${Number(target.other || 0).toFixed(2)}`, 54, 220);
  if (isComparison) {
    const fmt = value => formatSkillHistoryDate(value || new Date().toISOString());
    const base = Number(comparisonBaseline.total || 0);
    const change = total - base;
    const infoX = 54;
    const infoY = 239;
    const infoW = W - 108;
    c.fillStyle = '#15253a';
    c.fillRect(infoX, infoY, infoW, 94);

    const infoGap = 22;
    const infoCols = [
      { key: 'type',  label: '区分',      width: 82 },
      { key: 'date',  label: '日時',      width: 254 },
      { key: 'skill', label: 'スキル値',  width: 118 },
      { key: 'delta', label: '上昇値',    width: 118 }
    ];
    let cursor = infoX + 16;
    const colX = {};
    infoCols.forEach((col, index) => {
      colX[col.key] = cursor;
      cursor += col.width + (index < infoCols.length - 1 ? infoGap : 0);
    });

    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = '#94a3b8';
    c.font = '800 19px sans-serif';
    infoCols.forEach(col => c.fillText(col.label, colX[col.key], infoY + 18));

    c.fillStyle = '#f8fafc';
    c.font = '800 21px sans-serif';
    c.fillText('現在', colX.type, infoY + 46);
    c.fillText(fmt(validSnapshot?.savedAt || new Date()), colX.date, infoY + 46);
    c.fillText(total.toFixed(2), colX.skill, infoY + 46);
    c.fillStyle = change >= 0 ? '#60a5fa' : '#fca5a5';
    c.fillText(`${change > 0 ? '+' : ''}${change.toFixed(2)}`, colX.delta, infoY + 46);

    c.fillStyle = '#f8fafc';
    c.fillText('前回', colX.type, infoY + 76);
    c.fillText(fmt(comparisonBaseline.savedAt), colX.date, infoY + 76);
    c.fillText(base.toFixed(2), colX.skill, infoY + 76);
  }

  const drawPill = (label, left, top, width, height, bg, fg, border = null, font = 15) => {
    c.beginPath(); c.roundRect(left, top, width, height, 3);
    c.fillStyle = bg; c.fill();
    if (border) { c.strokeStyle = border; c.lineWidth = 1; c.stroke(); }
    c.font = `900 ${font}px sans-serif`; c.fillStyle = fg;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, left + width / 2, top + height / 2 + .5);
  };
  const fitText = (value, maxWidth, font) => {
    c.font = font;
    const source = String(value || '');
    if (c.measureText(source).width <= maxWidth) return source;
    let result = source;
    while (result.length > 1 && c.measureText(result + '…').width > maxWidth) result = result.slice(0, -1);
    return result + '…';
  };
  const drawMedal = (type, centerX, centerY) => {
    const icon = medalImages.get(type);
    if (icon) c.drawImage(icon, centerX - 13, centerY - 13, 26, 26);
  };
  // Use the same 170-degree diagonal as site song-card borders for ALL
  // non-solid skill-color gradients. Skill value side bars stay unchanged.
  const cardBorderPaint = (row, left, top, width, height) => {
    if (!row) return '#475569';
    if (row.type === 'solid') return row.color;
    // Sparkle-rainbow is already implemented in the shared helper.
    if (['rainbow', 'deep-rainbow', 'sparkle-rainbow'].includes(row.rank)) {
      return skillColorCanvasShareTextPaint(c, row, left, top, width, height);
    }
    const radians = 170 * Math.PI / 180;
    const dx = Math.sin(radians), dy = -Math.cos(radians);
    const cx = left + width / 2, cy = top + height / 2;
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    const gradient = c.createLinearGradient(cx - half * dx, cy - half * dy, cx + half * dx, cy + half * dy);
    for (const [color, percent] of row.stops || []) gradient.addColorStop(Number(percent) / 100, color);
    return gradient;
  };
  const gap = 24, colW = (W - 108 - gap) / 2;
  const drawTable = (caption, rows, left, accent) => {
    c.fillStyle = accent; c.fillRect(left, tableTop, colW, 40);
    c.fillStyle = '#0b1020'; c.font = '900 21px sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(caption, left + 10, tableTop + 27);
    rows.slice(0, 25).forEach((r, i) => {
      const y = tableTop + 46 + i * rowH;
      const skill = Number(r.skill || 0);
      // Match the site's 170-degree song-card border rather than a flat
      // vertical rainbow. Reuse the canonical skill-color stop definitions.
      const skillColor = getSkillColorRowByTotalValue(skill * 50);
      const border = skillColor.type === 'solid' ? skillColor.color
        : cardBorderPaint(skillColor, left, y, colW, rowH - 4);
      c.fillStyle = i % 2 ? '#0d1627' : '#111827';
      c.fillRect(left, y, colW, rowH - 4);
      c.strokeStyle = border; c.lineWidth = 2;
      c.strokeRect(left + 1, y + 1, colW - 2, rowH - 6);
      // Use a fixed left jacket area; missing jackets never change alignment.
      const jacketX = left + 9, jacketSize = 52, jacketY = y + (rowH - 4 - jacketSize) / 2;
      c.fillStyle = '#23354d'; c.fillRect(jacketX, jacketY, jacketSize, jacketSize);
      const img = jacketMap.get(String(r.title || ''));
      if (img) {
        const sourceSize = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const sx = ((img.naturalWidth || img.width) - sourceSize) / 2;
        const sy = ((img.naturalHeight || img.height) - sourceSize) / 2;
        c.save(); c.beginPath(); c.roundRect(jacketX, jacketY, jacketSize, jacketSize, 3); c.clip();
        c.drawImage(img, sx, sy, sourceSize, sourceSize, jacketX, jacketY, jacketSize, jacketSize);
        c.restore();
      } else {
        c.font = '700 24px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#94a3b8'; c.fillText('♫', jacketX + jacketSize / 2, jacketY + jacketSize / 2);
      }
      const contentX = jacketX + jacketSize + 10;
      const skillW = 99, skillX = left + colW - skillW - 7;
      const titleTop = y + 20;
      c.fillStyle = '#f8fafc'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.font = '900 19px sans-serif';
      c.fillText(fitText(r.title, skillX - contentX - 8, '900 19px sans-serif'), contentX, titleTop);

      // Details occupy the second line, matching the 2-row admin song cards.
      const pillTop = y + 41;
      const part = String(r.part || '');
      const partStyle = part.startsWith('MAS') ? ['#cf2ce4', '#fff']
        : part.startsWith('EXT') ? ['#f43f46', '#fff']
        : part.startsWith('ADV') ? ['#eab308', '#0b1020'] : ['#3b9ff2', '#fff'];
      // Measure the *visible glyphs*, not their padded columns. Every
      // adjacent item has the same optical gap, even when the rate is 99.xx%.
      // The achievement is reserved at its maximum 100.00% width.
      const detailGap = 10;
      const partW = 58, medalW = 26, optionW = 53;
      c.font = '800 16px sans-serif';
      const levelText = Number(r.level || 0).toFixed(2);
      const rateText = `${Number(r.achievement_rate || 0).toFixed(2)}%`;
      const levelW = Math.ceil(c.measureText('9.95').width);
      const rateW = Math.ceil(c.measureText('100.00%').width);
      const levelX = contentX + partW + detailGap;
      const rateX = levelX + levelW + detailGap;
      const medalX = rateX + rateW + detailGap;
      const optionX = medalX + medalW + detailGap;
      drawPill(part, contentX, pillTop, partW, 19, ...partStyle, null, 13);
      c.font = '800 16px sans-serif'; c.fillStyle = '#e2e8f0';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(levelText, levelX, pillTop + 10);
      c.fillText(rateText, rateX, pillTop + 10);
      const type = Number(r.achievement_rate) === 100 ? 'EXC' : String(r.fc || '').toUpperCase() === 'FC' ? 'FC' : '';
      drawMedal(type, medalX + medalW / 2, pillTop + 9);
      const option = String(r.play_option || 'NORMAL').toUpperCase();
      const optLabel = option === 'BASS_MIRROR' ? 'B-MIR' : option;
      const visibleOption = part.endsWith('-D') ? option === 'BASS_MIRROR' : option !== 'NORMAL';
      const optPalette = {
        'RAN':['#153326','#86efac','#15803d'], 'RAN+':['#123340','#67e8f9','#0369a1'],
        'SRA':['#302017','#fdba74','#c2410c'], 'SRA+':['#361b29','#fecdd3','#be123c'],
        'BASS_MIRROR':['#302044','#c4b5fd','#7c3aed']
      };
      if (visibleOption && optionX + optionW < skillX - 2) {
        const palette = optPalette[option] || ['#1e293b','#cbd5e1','#475569'];
        drawPill(optLabel, optionX, pillTop, optionW, 19, ...palette, 12);
      }

      // Skill is its own right-hand cell spanning both title and details lines.
      // In comparison mode, its delta is directly below the skill value.
      const skillCellTop = y + 6, skillCellH = rowH - 16;
      c.fillStyle = '#101827'; c.fillRect(skillX, skillCellTop, skillW, skillCellH);
      const paintRow = getSkillColorRowByTotalValue(skill * 50);
      for (const barX of [skillX, skillX + skillW - 5]) {
        c.fillStyle = skillColorCanvasShareTextPaint(c, paintRow, barX, skillCellTop, 5, skillCellH);
        c.fillRect(barX, skillCellTop, 5, skillCellH);
      }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffffff'; c.font = '900 21px sans-serif';
      const middleY = y + (rowH - 4) / 2;
      c.fillText(skill.toFixed(2), skillX + skillW / 2, middleY);
      if (paintRow.rank === 'sparkle-rainbow') {
        drawSkillColorCanvasSparkle(c, skillX + 3.5, skillCellTop + 11, 3.4, '#ffffff');
        drawSkillColorCanvasSparkle(c, skillX + skillW - 3.5, skillCellTop + skillCellH - 11, 3.4, '#fff7c2');
        drawSkillColorCanvasSparkle(c, left + colW - 10, y + 8, 3.2, '#ffffff');
        drawSkillColorCanvasSparkle(c, left + 8, y + rowH - 14, 3, '#bfdbfe');
      }
    });
  };
  if (isComparison) {
    c.fillStyle = '#243248';
    c.fillRect(54, tableTop, W - 108, 44);
    c.fillStyle = '#f8fafc';
    c.font = '900 23px sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`スキル更新曲  ${comparisonRows.length}曲`, 70, tableTop + 22);

    const left = 54, width = W - 108;
    const sectionPalette = {
      HOT: { bg: '#6a0d10', fg: '#ffffff', border: '#ef4444' },
      OTHER: { bg: '#173c50', fg: '#ffffff', border: '#38bdf8' }
    };
    const partPalette = part => {
      const value = String(part || '').toUpperCase();
      if (value.startsWith('MAS')) return ['#c51edd', '#ffffff'];
      if (value.startsWith('EXT')) return ['#ef4444', '#ffffff'];
      if (value.startsWith('ADV')) return ['#eab308', '#0f172a'];
      return ['#3b82f6', '#ffffff'];
    };
    const optionPalette = {
      'RAN':['#153326','#86efac','#15803d'],
      'RAN+':['#123340','#67e8f9','#0369a1'],
      'SRA':['#302017','#fdba74','#c2410c'],
      'SRA+':['#361b29','#fecdd3','#be123c'],
      'BASS_MIRROR':['#302044','#c4b5fd','#7c3aed']
    };

    const jacketX = left + 13;
    const jacketYInset = 20;
    const jacketSize = 102;
    const titleX = left + 126;
    const labelW = 50;
    const detailGap = 16;
    const partW = 78;
    const medalW = 26;
    const optionW = 63;
    const skillW = 96;
    const deltaW = 82;
    const valueFont = '800 19px sans-serif';
    const levelSample = '9.95';
    const rateSample = '100.00%';
    const formatPart = part => String(part || '—').toUpperCase();

    const detailBaseX = titleX;
    const partX = detailBaseX + labelW + detailGap;
    c.font = valueFont;
    const levelW = Math.ceil(c.measureText(levelSample).width);
    const rateW = Math.ceil(c.measureText(rateSample).width);
    const levelX = partX + partW + detailGap;
    const rateX = levelX + levelW + detailGap;
    const medalX = rateX + rateW + detailGap + medalW / 2;
    const optionX = medalX + medalW / 2 + detailGap;
    const skillValueRight = optionX + optionW + detailGap + skillW;
    const diffX = skillValueRight + detailGap;
    const skillBlockLeft = optionX + optionW + detailGap;

    const drawDetailLine = (row, label, baselineY, isPrevious, previousRow) => {
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = isPrevious ? '#94a3b8' : '#f8fafc';
      c.font = '800 19px sans-serif';
      c.fillText(label, detailBaseX, baselineY);
      if (!row) {
        c.fillText('—', partX, baselineY);
        return;
      }
      const part = formatPart(row.part);
      drawPill(part, partX, baselineY - 13, partW, 26, ...partPalette(part), null, 14);
      c.font = valueFont;
      c.fillStyle = isPrevious ? '#cbd5e1' : '#f8fafc';
      c.textAlign = 'left';
      c.fillText(Number(row.level || 0).toFixed(2), levelX, baselineY);
      c.fillText(`${Number(row.achievement_rate || 0).toFixed(2)}%`, rateX, baselineY);
      const fc = Number(row.achievement_rate || 0) >= 99.999 ? 'EXC'
        : String(row.fc || '').toUpperCase() === 'FC' ? 'FC' : '';
      drawMedal(fc, medalX, baselineY);
      const opt = String(row.play_option || 'NORMAL').toUpperCase();
      if (opt !== 'NORMAL') {
        const optionLabel = opt === 'BASS_MIRROR' ? 'B-MIR' : opt;
        drawPill(optionLabel, optionX, baselineY - 13, optionW, 26,
          ...(optionPalette[opt] || ['#1e293b','#cbd5e1','#475569']), 13);
      }
      c.fillStyle = isPrevious ? '#cbd5e1' : '#ffffff';
      c.font = '900 23px sans-serif';
      c.textAlign = 'right';
      c.fillText(Number(row.skill || 0).toFixed(2), skillValueRight, baselineY);
      c.textAlign = 'left';
      if (!isPrevious) {
        const delta = previousRow ? Number(row.skill || 0) - Number(previousRow.skill || 0) : null;
        c.font = '900 20px sans-serif';
        c.fillStyle = delta === null ? '#fdba74' : delta >= 0 ? '#60a5fa' : '#fca5a5';
        c.fillText(delta === null ? 'NEW' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`, diffX, baselineY);
      }
    };

    comparisonRows.forEach(({row, section}, i) => {
      const previous = matches.get(row) || null;
      const y = tableTop + 52 + i * 154;
      const cardHeight = 146;
      c.fillStyle = i % 2 ? '#0d1729' : '#111e31';
      c.fillRect(left, y, width, cardHeight);
      c.strokeStyle = '#667a92';
      c.lineWidth = 2;
      c.strokeRect(left + 1, y + 1, width - 2, cardHeight - 2);

      const jacketY = y + jacketYInset;
      c.fillStyle = '#23354d';
      c.fillRect(jacketX, jacketY, jacketSize, jacketSize);
      const img = jacketMap.get(String(row.title || ''));
      if (img) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const size = Math.min(iw, ih);
        c.save();
        c.beginPath();
        c.roundRect(jacketX, jacketY, jacketSize, jacketSize, 4);
        c.clip();
        c.drawImage(img, (iw - size) / 2, (ih - size) / 2, size, size, jacketX, jacketY, jacketSize, jacketSize);
        c.restore();
      }

      const marker = sectionPalette[section] || sectionPalette.HOT;
      drawPill(section, jacketX + (jacketSize - 68) / 2, y + 6, 68, 22, marker.bg, marker.fg, marker.border, 12);

      c.fillStyle = '#f8fafc';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = '900 26px sans-serif';
      const titleText = fitText(row.title, Math.max(160, skillBlockLeft - titleX - 18), '900 26px sans-serif');
      c.fillText(titleText, titleX, y + 27);

      drawDetailLine(row, '現在', y + 73, false, previous);
      drawDetailLine(previous, '前回', y + 111, true, previous);
    });

    if (!comparisonRows.length) {
      c.fillStyle = '#cbd5e1';
      c.font = '700 23px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('スキル値が上昇した曲・新規対象入りした曲はありません', W / 2, tableTop + 103);
    }
  } else {
    drawTable('HOT TOP 25', hotRows, 54, '#e94b88');
    drawTable('OTHER TOP 25', otherRows, 54 + colW + gap, '#83c63d');
  }
  c.fillStyle = '#0b1424'; c.fillRect(54, H - 62, W - 108, 30);
  c.fillStyle = '#94a3b8'; c.font = '700 24px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillText('GITADORA Skill Simulator', 64, H - 41);
  c.textAlign = 'right';
  c.fillText(new Date(validSnapshot?.savedAt || Date.now()).toLocaleDateString('ja-JP'), W - 64, H - 41);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('共有画像の生成に失敗しました。')), 'image/png');
  });
  return new File([blob], `GITADORA_${instrument}_skill.png`, {type:'image/png'});
}
