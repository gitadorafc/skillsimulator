import {
  getSkillColorRowByTotalValue,
  skillColorCanvasVerticalPaint,
  skillColorCanvasShareTextPaint,
  drawSkillColorCanvasSparkle,
  drawShareTotalSparkles
} from './skill-colors.js?v=4_14_33';
import { formatSkillHistoryDate } from './skill-history.js?v=4_14_45';
import { normalizeSongTitleForMatch } from './songs.js?v=4_15_6';

export async function renderSkillShareFile({
  instrument,
  snapshot = null,
  comparisonBaseline = null,
  currentTotals,
  currentVersionName = '',
  username = ''
}) {
  // Array.mapのコールバックとして渡された場合のindexなどを、
  // 履歴スナップショットとして誤認しない。
  const validSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot
    : null;
  const target = validSnapshot || currentTotals;
  const rowsHot = target.hotRows || [];
  const rowsOther = target.otherRows || [];
  const isComparison = Boolean(comparisonBaseline);
  // スマホで見やすいよう、HOT / OTHER を左右2カラムに戻す。
  // 背景はダークのまま維持。
  const W = 1400;
  const H = isComparison ? 2200 : 2000;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');

  const totalPaint = (value, left, top, width, height) =>
    skillColorCanvasShareTextPaint(x, getSkillColorRowByTotalValue(value), left, top, width, height);
  // 共有画像の外枠も画面上の登録曲一覧と同じスキルカラーを使う。
  // CanvasのstrokeStyleにはCanvasGradientを直接渡せるため、
  // RAINBOW等を代表色1色へ潰さず、そのままグラデーション枠として描画する。
  const songBorderPaint = (value, left, top, width, height) =>
    skillColorCanvasVerticalPaint(
      x,
      getSkillColorRowByTotalValue((Number(value) || 0) * 50),
      left,
      top,
      width,
      height
    );

  // background
  x.fillStyle = '#07101d';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#0f1a2d';
  x.fillRect(28, 28, W - 56, H - 56);

  // header: 以前のシンプルなレイアウトに戻す
  x.fillStyle = '#f8fafc';
  x.font = '900 42px sans-serif';
  const shareGameTitle = instrument === 'GF'
    ? 'GITADORA GuitarFreaks Skill'
    : 'GITADORA DrumMania Skill';
  x.fillText(shareGameTitle, 54, 82);

  x.fillStyle = '#94a3b8';
  x.font = '700 24px sans-serif';
  x.fillText(validSnapshot?.versionName || currentVersionName, 54, 118);

  // ユーザー名 + TOTALスキルを横並び。
  // 旧ユーザー名(22px)と旧TOTAL(68px)の中間程度として42pxに統一。
  // 両方ともTOTALスキルカラーに準拠する。
  const shareUsername = String(validSnapshot?.username || username).trim();
  const shareTotal = Number(target.total).toFixed(2);
  const shareLineY = 174;
  const shareFontSize = 42;
  const shareGap = 28;

  x.font = `900 ${shareFontSize}px sans-serif`;
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';

  let shareNameText = shareUsername || 'USER';
  const maxNameWidth = 700;
  while (x.measureText(shareNameText).width > maxNameWidth && shareNameText.length > 2) {
    shareNameText = shareNameText.slice(0, -1);
  }
  if (shareNameText !== (shareUsername || 'USER')) {
    shareNameText = shareNameText.slice(0, -1) + '…';
  }

  const nameWidth = x.measureText(shareNameText).width;
  const totalX = 54 + nameWidth + shareGap;
  const totalWidth = x.measureText(shareTotal).width;

  // ユーザー名とTOTALスキルは、それぞれの文字幅で独立して
  // 同じスキルカラーのグラデーションを描画する。
  x.fillStyle = totalPaint(target.total, 54, 132, nameWidth, 52);
  x.fillText(shareNameText, 54, shareLineY);
  x.fillStyle = totalPaint(target.total, totalX, 132, totalWidth, 52);
  x.fillText(shareTotal, totalX, shareLineY);

  drawShareTotalSparkles(
    x,
    getSkillColorRowByTotalValue(target.total),
    54,
    nameWidth,
    totalX,
    totalWidth,
    132,
    52
  );

  x.fillStyle = '#94a3b8';
  x.font = '800 26px sans-serif';
  x.fillText(`HOT ${Number(target.hot).toFixed(2)}   OTHER ${Number(target.other).toFixed(2)}`,54,220);
  if (isComparison) {
    c.fillStyle = '#243248';
    c.fillRect(54, tableTop, W - 108, 44);
    c.fillStyle = '#f8fafc';
    c.font = '900 23px sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`スキル更新曲  ${comparisonRows.length}曲`, 70, tableTop + 22);

    const left = 54;
    const width = W - 108;
    const rightAreaW = 184;
    const skillCellW = 118;
    const skillX = left + width - rightAreaW - 18;
    const deltaX = skillX + skillCellW + 8;
    const contentX = left + 110;
    const artSize = 72;
    const detailLabelWidth = 58;
    const detailGap = 12;
    const sectionPalette = {
      HOT: {bg: '#e94b88', fg: '#0b1020', border: '#be185d'},
      OTHER: {bg: '#83c63d', fg: '#0b1020', border: '#5f9423'}
    };
    const partPalette = part => {
      if (part.startsWith('MAS')) return ['#bb20c9', '#fff'];
      if (part.startsWith('EXT')) return ['#f43f46', '#fff'];
      if (part.startsWith('ADV')) return ['#eab308', '#0b1020'];
      return ['#3b9ff2', '#fff'];
    };
    const optPalette = {
      'RAN':['#153326','#86efac','#15803d'], 'RAN+':['#123340','#67e8f9','#0369a1'],
      'SRA':['#302017','#fdba74','#c2410c'], 'SRA+':['#361b29','#fecdd3','#be123c'],
      'BASS_MIRROR':['#302044','#c4b5fd','#7c3aed']
    };
    const drawComparisonSkillCell = (record, leftX, topY, currentRecord = null) => {
      if (!record) return;
      const skill = Number(record.skill || 0);
      const paint = getSkillColorRowByTotalValue(skill * 50);
      c.fillStyle = '#0b1424';
      c.fillRect(leftX, topY, skillCellW, 28);
      for (const bx of [leftX, leftX + skillCellW - 5]) {
        c.fillStyle = skillColorCanvasShareTextPaint(c, paint, bx, topY, 5, 28);
        c.fillRect(bx, topY, 5, 28);
      }
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      c.font = '900 22px sans-serif';
      c.fillStyle = '#f8fafc';
      c.fillText(skill.toFixed(2), leftX + skillCellW - 11, topY + 14);
      if (paint.rank === 'sparkle-rainbow') {
        drawSkillColorCanvasSparkle(c, leftX + 4, topY + 8, 2.8, '#ffffff');
        drawSkillColorCanvasSparkle(c, leftX + skillCellW - 4, topY + 20, 2.8, '#fff7c2');
      }
      if (currentRecord === record) {
        const previous = matches.get(record);
        c.textAlign = 'left';
        c.font = '900 17px sans-serif';
        const diff = previous ? Number(record.skill || 0) - Number(previous.skill || 0) : null;
        if (diff === null) {
          c.fillStyle = '#fdba74';
          c.fillText('NEW', deltaX, topY + 14);
        } else if (Math.abs(diff) >= .005) {
          c.fillStyle = diff > 0 ? '#60a5fa' : '#fca5a5';
          c.fillText(`${diff > 0 ? '+' : ''}${diff.toFixed(2)}`, deltaX, topY + 14);
        }
      }
    };
    const drawInfoLine = (record, topY, label, emphasized) => {
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = emphasized ? '#f8fafc' : '#94a3b8';
      c.font = '900 18px sans-serif';
      c.fillText(label, contentX, topY + 11);
      if (!record) {
        c.font = '700 18px sans-serif';
        c.fillText('対象外', contentX + detailLabelWidth + 4, topY + 11);
        return;
      }
      const part = String(record.part || '').toUpperCase();
      let xx = contentX + detailLabelWidth + 4;
      drawPill(part, xx, topY, 72, 22, ...partPalette(part), null, 13);
      xx += 72 + detailGap;
      c.fillStyle = emphasized ? '#e2e8f0' : '#a9b6c8';
      c.font = '800 18px sans-serif';
      c.fillText(Number(record.level || 0).toFixed(2), xx, topY + 11);
      xx += 58;
      c.fillText(`${Number(record.achievement_rate || 0).toFixed(2)}%`, xx, topY + 11);
      xx += 92;
      const medal = Number(record.achievement_rate) === 100 ? 'EXC' : String(record.fc || '').toUpperCase() === 'FC' ? 'FC' : '';
      if (medal) drawMedal(medal, xx + 12, topY + 11);
      xx += 32;
      const option = String(record.play_option || 'NORMAL').toUpperCase();
      const visible = part.endsWith('-D') ? option === 'BASS_MIRROR' : option !== 'NORMAL';
      if (visible) {
        const palette = optPalette[option] || ['#1e293b','#cbd5e1','#475569'];
        drawPill(option === 'BASS_MIRROR' ? 'B-MIR' : option, xx, topY, 60, 22, ...palette, 13);
      }
    };
    comparisonRows.forEach(({row:r, section}, i) => {
      const previous = matches.get(r);
      const y = tableTop + 52 + i * (comparisonCardHeight + comparisonCardGap);
      c.fillStyle = i % 2 ? '#0d1729' : '#111e31';
      c.fillRect(left, y, width, comparisonCardHeight);
      c.strokeStyle = '#667a92';
      c.lineWidth = 2;
      c.strokeRect(left + 1, y + 1, width - 2, comparisonCardHeight - 2);

      const artX = left + 12;
      const artY = y + 22;
      c.fillStyle = '#23354d';
      c.fillRect(artX, artY, artSize, artSize);
      const img = jacketMap.get(String(r.title || ''));
      if (img) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const size = Math.min(iw, ih);
        c.save();
        c.beginPath();
        c.roundRect(artX, artY, artSize, artSize, 4);
        c.clip();
        c.drawImage(img, (iw - size) / 2, (ih - size) / 2, size, size, artX, artY, artSize, artSize);
        c.restore();
      }

      c.fillStyle = '#f8fafc';
      c.font = '900 23px sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const titleMaxW = skillX - contentX - 106;
      const titleText = fitText(r.title, titleMaxW, '900 23px sans-serif');
      c.fillText(titleText, contentX, y + 23);
      const titleWidth = c.measureText(titleText).width;
      const palette = sectionPalette[section] || sectionPalette.HOT;
      const badgeX = Math.min(contentX + titleWidth + 14, skillX - 84);
      drawPill(section, badgeX, y + 11, 74, 22, palette.bg, palette.fg, palette.border, 13);

      drawInfoLine(r, y + 42, '現在', true);
      drawInfoLine(previous, y + 74, '前回', false);
      drawComparisonSkillCell(r, skillX, y + 39, r);
      drawComparisonSkillCell(previous, skillX, y + 71);
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
