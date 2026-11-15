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
    x.textAlign = 'right';
    x.font = '800 18px sans-serif';
    x.fillText(`比較: ${formatSkillHistoryDate(comparisonBaseline.savedAt)}`, W - 54, 220);
    x.textAlign = 'left';
  }

  const gap = 24;
  const colW = (W - 108 - gap) / 2;
  const leftHot = 54;
  const leftOther = 54 + colW + gap;
  const tableTop = 256;

  const drawTable = (sectionTitle, rows, left, accent, baselineRows = []) => {
    const tableW = colW;
    const titleH = 40;
    const headerH = 48;
    const rowH = isComparison ? 66 : 58;
    const cols = [44, 326, 104, 106, 78]; // No / 譜面 / Skill / 達成率 / Lv
    const scale = tableW / cols.reduce((a,b)=>a+b,0);
    const widths = cols.map(v => v*scale);
    const pos=[left];
    widths.forEach(w=>pos.push(pos[pos.length-1]+w));

    x.fillStyle=accent;
    x.fillRect(left,tableTop,tableW,titleH);
    x.fillStyle='#0b1020';
    x.font='900 21px sans-serif';
    x.fillText(sectionTitle,left+10,tableTop+27);

    const headTop=tableTop+titleH;
    x.fillStyle='#111827'; x.fillRect(left,headTop,tableW,headerH);
    x.strokeStyle='#94a3b8'; x.lineWidth=1;

    const labels=[isComparison ? '順位' : 'No.','譜面','SKILL','達成率','Lv'];
    labels.forEach((label,i)=>{
      x.strokeRect(pos[i],headTop,widths[i],headerH);
      x.fillStyle='#e5e7eb'; x.font='800 14px sans-serif'; x.textAlign='center'; x.textBaseline='middle';
      x.fillText(label,pos[i]+widths[i]/2,headTop+headerH/2);
    });

    const baselineByTitle = new Map();
    const comparisonKey = row => `${normalizeSongTitleForMatch(String(row?.title || ''))}\u0000${String(row?.part || '').toUpperCase()}`;
    baselineRows.slice(0, 25).forEach((row, index) => {
      const key = comparisonKey(row);
      if (key && !baselineByTitle.has(key)) baselineByTitle.set(key, { row, index });
    });

    rows.slice(0,25).forEach((r,i)=>{
      const y=headTop+headerH+i*rowH;
      x.fillStyle=i%2===0 ? '#111827' : '#0d1627';
      x.fillRect(left,y,tableW,rowH);

      // 各曲の外枠は、その曲のSKILLカラーに合わせる。
      // セル内部の縦線は控えめな共通色のままにして可読性を維持する。
      x.strokeStyle = songBorderPaint(r.skill, left, y, tableW, rowH);
      x.lineWidth = 2;
      x.strokeRect(left, y, tableW, rowH);
      x.strokeStyle = '#475569';
      x.lineWidth = 1;
      for(let c=1;c<widths.length;c++) {
        x.beginPath();
        x.moveTo(pos[c], y);
        x.lineTo(pos[c], y + rowH);
        x.stroke();
      }

      // 順位。比較時は順位変動を淡い色で表示する。
      const comparison = isComparison
        ? baselineByTitle.get(comparisonKey(r))
        : null;
      const isNew = isComparison && !comparison;
      const rankDirection = comparison
        ? (i < comparison.index ? 'up' : i > comparison.index ? 'down' : 'same')
        : (isNew ? 'new' : 'same');
      const rankLabel = isNew
        ? 'new'
        : isComparison && rankDirection === 'up'
          ? `${i + 1} ↑`
          : isComparison && rankDirection === 'down'
            ? `${i + 1} ↓`
            : String(i + 1);
      x.fillStyle = rankDirection === 'up'
        ? '#fda4af'
        : rankDirection === 'down'
          ? '#93c5fd'
          : rankDirection === 'new'
            ? '#fdba74'
            : '#cbd5e1';
      x.font = isNew ? '900 14px sans-serif' : '800 17px sans-serif';
      x.textAlign='center'; x.textBaseline='middle';
      x.fillText(rankLabel,pos[0]+widths[0]/2,y+rowH/2);

      // title + badges
      x.textAlign='left';
      x.textBaseline='middle';
      x.fillStyle='#f8fafc';
      x.font='900 20px sans-serif';
      let titleText=String(r.title||'');
      while(x.measureText(titleText).width > widths[1]-16 && titleText.length>4) titleText=titleText.slice(0,-1);
      if(titleText!==String(r.title||'')) titleText=titleText.slice(0,-1)+'…';
      x.fillText(titleText,pos[1]+8,y+19);

      const partText = String(r.part || '');
      const partX = pos[1] + 8;
      const optionText = String(r.play_option || 'NORMAL').toUpperCase();
      const optionLabel = optionText === 'BASS_MIRROR' ? 'B-MIR' : optionText;
      const showOption =
        (partText.endsWith('-D') && optionText === 'BASS_MIRROR') ||
        (!partText.endsWith('-D') && optionText !== 'NORMAL');
      const badge = Number(r.achievement_rate)===100
        ? 'EXC'
        : (String(r.fc||'').toUpperCase()==='FC' ? 'FC' : '');

      const optionStyles = {
        'RAN':  { text:'#86efac', border:'#15803d', bg:'rgba(20,83,45,.34)' },
        'SRA':  { text:'#fdba74', border:'#c2410c', bg:'rgba(124,45,18,.38)' },
        'RAN+': { text:'#4ade80', border:'#166534', bg:'rgba(20,83,45,.34)' },
        'SRA+': { text:'#fb923c', border:'#9a3412', bg:'rgba(124,45,18,.38)' },
        'BASS_MIRROR': { text:'#c4b5fd', border:'#7c3aed', bg:'rgba(76,29,149,.28)' }
      };

      // 横並びカードと同じ「パート / FC・EXC / オプション」の順序で、
      // 3種類のバッジを同じ寸法に固定して描画する。
      // FC・EXCやオプションがない場合も、それぞれの列位置は詰めない。
      const badgeY = y + (isComparison ? 42 : 36);
      const badgeW = 62;
      const badgeH = 17;
      const badgeGap = 6;
      const fcX = partX + badgeW + badgeGap;
      const optionX = fcX + badgeW + badgeGap;

      const partStyle = partText.startsWith('MAS')
        ? { bg:'#dc5af0', text:'#ffffff' }
        : partText.startsWith('EXT')
          ? { bg:'#ff5656', text:'#ffffff' }
          : partText.startsWith('ADV')
            ? { bg:'#f5d65b', text:'#000000' }
            : { bg:'#76b8f5', text:'#ffffff' };
      x.fillStyle = partStyle.bg;
      x.beginPath();
      x.roundRect(partX, badgeY, badgeW, badgeH, 3);
      x.fill();
      x.fillStyle = partStyle.text;
      x.font = '900 12px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(partText, partX + badgeW / 2, badgeY + badgeH / 2 + .5);

      if (badge) {
        const bg=x.createLinearGradient(fcX,badgeY,fcX,badgeY+badgeH);
        if(badge==='EXC'){
          bg.addColorStop(0,'#fef08a');
          bg.addColorStop(1,'#f59e0b');
        }else{
          bg.addColorStop(0,'#ffffff');
          bg.addColorStop(.5,'#cbd5e1');
          bg.addColorStop(1,'#94a3b8');
        }
        x.fillStyle=bg;
        x.beginPath();
        x.roundRect(fcX,badgeY,badgeW,badgeH,3);
        x.fill();
        x.strokeStyle=badge==='EXC'?'#b45309':'#475569';
        x.lineWidth=1;
        x.stroke();
        x.fillStyle=badge==='EXC'?'#7f1d1d':'#1e3a8a';
        x.font='900 12px sans-serif';
        x.fillText(badge,fcX+badgeW/2,badgeY+badgeH/2+.5);
      }

      if (showOption) {
        const st = optionStyles[optionText] || { text:'#cbd5e1', border:'#475569', bg:'rgba(30,41,59,.5)' };
        x.fillStyle = st.bg;
        x.beginPath();
        x.roundRect(optionX, badgeY, badgeW, badgeH, 3);
        x.fill();
        x.strokeStyle = st.border;
        x.lineWidth = 1;
        x.stroke();
        x.fillStyle = st.text;
        x.font = optionText === 'BASS_MIRROR'
          ? '900 11px sans-serif'
          : '900 12px sans-serif';
        x.fillText(optionLabel, optionX + badgeW / 2, badgeY + badgeH / 2 + .5);
      }

      x.textAlign='left';
      x.textBaseline='alphabetic';

      // SKILL:
      // 数字は白固定。左右の帯だけを、その曲のスキルカラーで表示する。
      const sv=Number(r.skill)||0;
      const skillCellX=pos[2];
      const skillCellW=widths[2];
      const barW=7;
      const barY=y+5;
      const barH=rowH-10;
      const songRow=getSkillColorRowByTotalValue(sv*50);

      x.fillStyle='#101827';
      x.fillRect(skillCellX+1,y+1,skillCellW-2,rowH-2);

      x.fillStyle=skillColorCanvasVerticalPaint(x,songRow,skillCellX,barY,barW,barH);
      x.fillRect(skillCellX+2,barY,barW,barH);

      x.fillStyle=skillColorCanvasVerticalPaint(x,songRow,skillCellX+skillCellW-barW-2,barY,barW,barH);
      x.fillRect(skillCellX+skillCellW-barW-2,barY,barW,barH);

      x.fillStyle='#ffffff';
      x.font='900 20px sans-serif';
      x.textAlign='center';
      x.textBaseline='middle';
      x.shadowColor='rgba(0,0,0,.9)';
      x.shadowBlur=2;
      const valueMainY = isComparison ? y + 21 : y + rowH / 2;
      const valueDeltaY = y + 47;
      x.fillText(sv.toFixed(2),skillCellX+skillCellW/2,valueMainY);
      x.shadowBlur=0;
      x.shadowColor='transparent';

      const drawComparisonDelta = (currentValue, previousValue, centerX) => {
        if (!isComparison) return;
        x.font = '900 12px sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        if (isNew) {
          x.fillStyle = '#fdba74';
          x.fillText('new', centerX, valueDeltaY);
          return;
        }
        const delta = Number(currentValue) - Number(previousValue);
        x.fillStyle = delta > .0001 ? '#86efac' : delta < -.0001 ? '#93c5fd' : '#94a3b8';
        const prefix = delta > .0001 ? '+' : delta < -.0001 ? '' : '±';
        x.fillText(`${prefix}${Math.abs(delta) < .0001 ? '0.00' : delta.toFixed(2)}`, centerX, valueDeltaY);
      };
      drawComparisonDelta(sv, comparison?.row?.skill, skillCellX + skillCellW / 2);

      // 達成率を上下中央へ置き、FC/EXCは曲名列へ表示する。
      x.fillStyle='#f8fafc';
      x.font='800 18px sans-serif';
      x.fillText(
        `${Number(r.achievement_rate).toFixed(2)}%`,
        pos[3]+widths[3]/2,
        isComparison ? valueMainY : y+rowH/2
      );
      drawComparisonDelta(
        Number(r.achievement_rate) || 0,
        comparison?.row?.achievement_rate,
        pos[3] + widths[3] / 2
      );

      // level
      x.fillStyle='#e5e7eb';
      x.font='800 18px sans-serif';
      x.fillText(Number(r.level).toFixed(2),pos[4]+widths[4]/2,y+rowH/2);

      // 共有画像の9500帯だけは、曲別SKILL帯と外枠の上に固定の輝きを重ねる。
      // 画面側カードの枠内には光点を置かない。
      if (songRow.rank === 'sparkle-rainbow') {
        drawSkillColorCanvasSparkle(x, skillCellX + 5, barY + 11, 3.4, '#ffffff');
        drawSkillColorCanvasSparkle(x, skillCellX + skillCellW - 5, barY + barH - 10, 3.4, '#fff7c2');
        drawSkillColorCanvasSparkle(x, left + tableW * .72, y + 1.5, 3.2, '#ffffff');
        drawSkillColorCanvasSparkle(x, left + 1.5, y + rowH * .66, 3, '#bfdbfe');
      }
    });

    x.textAlign='left'; x.textBaseline='alphabetic';
  };

  drawTable('HOT TOP 25', rowsHot, leftHot, '#e94b88', comparisonBaseline?.hotRows || []);
  drawTable('OTHER TOP 25', rowsOther, leftOther, '#83c63d', comparisonBaseline?.otherRows || []);

  // footer
  x.fillStyle='#0b1424'; x.fillRect(54,H-62,W-108,30);
  x.fillStyle='#94a3b8'; x.font='700 24px sans-serif';
  x.fillText('GITADORA Skill Simulator',64,H-41);
  x.textAlign='right';
  x.fillText(new Date(validSnapshot?.savedAt || Date.now()).toLocaleDateString('ja-JP'),W-64,H-41);
  x.textAlign='left';

  const blob = await new Promise((resolve, reject) => {
    c.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error(`${instrument}の共有画像を生成できませんでした。`));
    }, 'image/png');
  });

  return new File([blob], `GITADORA_${instrument}_skill.png`, { type: 'image/png' });
}


/* Admin-only image format. The public image renderer above is deliberately
   unchanged. Layout is shared by normal and comparison exports. */
export async function renderAdminJacketSkillShareFile({
  instrument, snapshot = null, comparisonBaseline = null, currentTotals,
  currentVersionName = '', username = '', getJacketUrls = () => [], getMedalSvg = () => ''
}) {
  const validSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
  const target = validSnapshot || currentTotals;
  const isComparison = Boolean(comparisonBaseline);
  const rowH = isComparison ? 90 : 70;
  const W = 1400;
  const H = isComparison ? 2720 : 2180;
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
  const titles = [...new Set([...(target.hotRows || []), ...(target.otherRows || [])]
    .slice(0, 50).map(row => String(row.title || '')))];
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
    c.textAlign = 'right'; c.font = '800 18px sans-serif';
    c.fillText(`比較: ${formatSkillHistoryDate(comparisonBaseline.savedAt)}`, W - 54, 220);
    c.textAlign = 'left';
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
  const deltaLabel = (current, prior, newRow) => {
    if (newRow) return 'new';
    const value = Number(current || 0) - Number(prior || 0);
    if (Math.abs(value) < .005) return '';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
  };
  const deltaColor = (current, prior, newRow) => {
    if (newRow) return '#fdba74';
    const diff = Number(current || 0) - Number(prior || 0);
    return diff > .0001 ? '#86efac' : diff < -.0001 ? '#93c5fd' : '#94a3b8';
  };
  const compareKey = row => `${normalizeSongTitleForMatch(String(row?.title || ''))}\u0000${String(row?.part || '').toUpperCase()}`;
  const gap = 24, colW = (W - 108 - gap) / 2, tableTop = 256;
  const drawTable = (caption, rows, left, accent, baselineRows = []) => {
    const baseline = new Map();
    baselineRows.slice(0, 25).forEach((row, index) => {
      const key = compareKey(row);
      if (!baseline.has(key)) baseline.set(key, { row, index });
    });
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
        : skillColorCanvasShareTextPaint(c, skillColor, left, y, colW, rowH - 4);
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
      const titleTop = y + (isComparison ? 22 : 20);
      c.fillStyle = '#f8fafc'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.font = '900 19px sans-serif';
      c.fillText(fitText(r.title, skillX - contentX - 8, '900 19px sans-serif'), contentX, titleTop);

      // Details occupy the second line, matching the 2-row admin song cards.
      const pillTop = y + (isComparison ? 43 : 41);
      const part = String(r.part || '');
      const partStyle = part.startsWith('MAS') ? ['#cf2ce4', '#fff']
        : part.startsWith('EXT') ? ['#f43f46', '#fff']
        : part.startsWith('ADV') ? ['#eab308', '#0b1020'] : ['#3b9ff2', '#fff'];
      drawPill(part, contentX, pillTop, 58, 19, ...partStyle, null, 13);
      let point = contentX + 63;
      c.font = '800 16px sans-serif'; c.fillStyle = '#e2e8f0';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(Number(r.level || 0).toFixed(2), point, pillTop + 10);
      point += 48;
      c.fillText(`${Number(r.achievement_rate || 0).toFixed(2)}%`, point, pillTop + 10);
      if (isComparison) {
        const comparison = baseline.get(compareKey(r));
        const rateDelta = deltaLabel(r.achievement_rate, comparison?.row?.achievement_rate, !comparison);
        if (rateDelta) {
          c.font = '800 12px sans-serif';
          c.fillStyle = deltaColor(r.achievement_rate, comparison?.row?.achievement_rate, !comparison);
          c.fillText(rateDelta + (comparison ? '%' : ''), point, y + 76);
        }
      }
      point += 92;
      const type = Number(r.achievement_rate) === 100 ? 'EXC' : String(r.fc || '').toUpperCase() === 'FC' ? 'FC' : '';
      drawMedal(type, point + 10, pillTop + 9);
      point += 38; // breathing room between the FC medal and option badge
      const option = String(r.play_option || 'NORMAL').toUpperCase();
      const optLabel = option === 'BASS_MIRROR' ? 'B-MIR' : option;
      const visibleOption = part.endsWith('-D') ? option === 'BASS_MIRROR' : option !== 'NORMAL';
      const optPalette = {
        'RAN':['#153326','#86efac','#15803d'], 'RAN+':['#123340','#67e8f9','#0369a1'],
        'SRA':['#302017','#fdba74','#c2410c'], 'SRA+':['#361b29','#fecdd3','#be123c'],
        'BASS_MIRROR':['#302044','#c4b5fd','#7c3aed']
      };
      if (visibleOption && point + 53 < skillX - 2) {
        const palette = optPalette[option] || ['#1e293b','#cbd5e1','#475569'];
        drawPill(optLabel, point, pillTop, 53, 19, ...palette, 12);
      }

      // Skill is its own right-hand cell spanning both title and details lines.
      // In comparison mode, its delta is directly below the skill value.
      const skillCellTop = y + 6, skillCellH = rowH - 16;
      c.fillStyle = '#101827'; c.fillRect(skillX, skillCellTop, skillW, skillCellH);
      const paintRow = getSkillColorRowByTotalValue(skill * 50);
      for (const barX of [skillX, skillX + skillW - 5]) {
        c.fillStyle = skillColorCanvasVerticalPaint(c, paintRow, barX, skillCellTop, 5, skillCellH);
        c.fillRect(barX, skillCellTop, 5, skillCellH);
      }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffffff'; c.font = '900 21px sans-serif';
      const middleY = y + (rowH - 4) / 2;
      c.fillText(skill.toFixed(2), skillX + skillW / 2, isComparison ? middleY - 9 : middleY);
      if (isComparison) {
        const previous = baseline.get(compareKey(r));
        c.fillStyle = deltaColor(skill, previous?.row?.skill, !previous);
        c.font = '900 13px sans-serif';
        const skillDelta = deltaLabel(skill, previous?.row?.skill, !previous);
        if (skillDelta) c.fillText(skillDelta, skillX + skillW / 2, middleY + 14);
      }
    });
  };
  drawTable('HOT TOP 25', target.hotRows || [], 54, '#e94b88', comparisonBaseline?.hotRows || []);
  drawTable('OTHER TOP 25', target.otherRows || [], 54 + colW + gap, '#83c63d', comparisonBaseline?.otherRows || []);
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
