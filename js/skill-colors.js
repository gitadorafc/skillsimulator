/* === v21 FIX28: SINGLE SOURCE OF TRUTH / SKILL COLOR TABLE ===
   サイト表示・ユーザーリスト・共有画像は、すべてこのテーブルを参照する。
   配色を変更するときは原則ここだけ変更する。
*/
const SKILL_COLOR_TABLE = Object.freeze([
  // 9500帯は全ユーザー公開。配色は9000帯と同じで、表示側に光点を追加する。
  { min: 9500, rank: 'sparkle-rainbow', type: 'gradient', direction: '90deg',
    stops: [['#e60000',0],['#f05a00',14.2857],['#e6b800',28.5714],['#12a936',42.8571],['#00aeb5',57.1429],['#1559e6',71.4286],['#681fd1',85.7143],['#bf16ad',100]] },
  { min: 9000, rank: 'deep-rainbow', type: 'gradient', direction: '90deg',
    stops: [['#e60000',0],['#f05a00',14.2857],['#e6b800',28.5714],['#12a936',42.8571],['#00aeb5',57.1429],['#1559e6',71.4286],['#681fd1',85.7143],['#bf16ad',100]] },
  { min: 8500, rank: 'rainbow', type: 'gradient', direction: '90deg',
    stops: [['#ff8787',0],['#ffad6f',14.2857],['#f0d967',28.5714],['#7bd889',42.8571],['#6fd3d0',57.1429],['#7ca9f5',71.4286],['#aa88eb',85.7143],['#df82d4',100]] },
  { min: 8000, rank: 'gold', type: 'gradient', direction: '180deg',
    stops: [['#d89a00',0],['#ffd83d',58],['#ffffff',100]] },
  { min: 7500, rank: 'silver', type: 'gradient', direction: '180deg',
    stops: [['#8e99a5',0],['#d8dde3',58],['#ffffff',100]] },
  { min: 7000, rank: 'bronze', type: 'gradient', direction: '180deg',
    stops: [['#7d3f20',0],['#c77b45',52],['#ffffff',100]] },
  { min: 6500, rank: 'red-grad', type: 'gradient', direction: '180deg',
    stops: [['#c70023',0],['#ff4d68',58],['#ffffff',100]] },
  { min: 6000, rank: 'red', type: 'solid', color: '#ff1638' },
  { min: 5500, rank: 'purple-grad', type: 'gradient', direction: '180deg',
    stops: [['#a400d2',0],['#ea5cff',58],['#ffffff',100]] },
  { min: 5000, rank: 'purple', type: 'solid', color: '#e02cff' },
  { min: 4500, rank: 'blue-grad', type: 'gradient', direction: '180deg',
    stops: [['#0966d9',0],['#53adff',58],['#ffffff',100]] },
  { min: 4000, rank: 'blue', type: 'solid', color: '#2f91ff' },
  { min: 3500, rank: 'green-grad', type: 'gradient', direction: '180deg',
    stops: [['#0c9f2b',0],['#44e45b',55],['#ffffff',100]] },
  { min: 3000, rank: 'green', type: 'solid', color: '#22d13b' },
  { min: 2500, rank: 'yellow-grad', type: 'gradient', direction: '180deg',
    stops: [['#f5c400',0],['#ffe94d',55],['#ffffff',100]] },
  { min: 2000, rank: 'yellow', type: 'solid', color: '#ffe600' },
  { min: 1500, rank: 'orange-grad', type: 'gradient', direction: '180deg',
    stops: [['#ff5a00',0],['#ff9b43',58],['#ffffff',100]] },
  { min: 1000, rank: 'orange', type: 'solid', color: '#ff7a22' },
  { min: 0, rank: 'white', type: 'solid', color: '#ffffff' }
]);

export function getSkillColorRowByTotalValue(totalValue) {
  const value = Number(totalValue) || 0;
  return SKILL_COLOR_TABLE.find(row => value >= row.min)
    || SKILL_COLOR_TABLE[SKILL_COLOR_TABLE.length - 1];
}

function skillColorCss(row) {
  if (!row) return '#ffffff';
  if (row.type === 'solid') return row.color;
  return `linear-gradient(${row.direction || '90deg'}, ${row.stops.map(([color,pos]) => `${color} ${pos}%`).join(', ')})`;
}

function skillColorVerticalCss(row) {
  if (!row) return '#ffffff';

  // 単色ランクは完全な単色。
  // TOTAL / HOT / OTHER / ユーザーリスト / ライバル管理など、
  // score-rank-* を使う表示はすべて同じ単色になる。
  if (row.type === 'solid') {
    return row.color;
  }

  // RAINBOW文字だけは、CSSのline-box内で文字そのものが占める高さが狭いため、
  // 0～100%をそのまま使うと中央の緑～青付近しか見えない。
  // 色・順番は左右帯と完全に同じまま、停止位置だけ12～88%へ圧縮して
  // 赤～紫まで文字の中に見えるようにする。
  if (row.rank === 'rainbow' || row.rank === 'deep-rainbow' || row.rank === 'sparkle-rainbow') {
    const stops = row.stops.map(([color,pos]) => {
      const mapped = 12 + (Number(pos) / 100) * 76;
      return `${color} ${mapped}%`;
    });
    return `linear-gradient(180deg, ${stops.join(', ')})`;
  }

  // グラデーションランクだけ0%=上、100%=下。
  return `linear-gradient(180deg, ${row.stops.map(([color,pos]) => `${color} ${pos}%`).join(', ')})`;
}

function installSkillColorCss() {
  const old = document.getElementById('skill-color-table-style');
  if (old) old.remove();

  const style = document.createElement('style');
  style.id = 'skill-color-table-style';

  style.textContent = SKILL_COLOR_TABLE.map(row => {
    const paint = row.type === 'solid' ? row.color : skillColorCss(row);

    // TOTAL / HOT / OTHER / ユーザーリスト等の文字色
    const textPaint = skillColorVerticalCss(row);
    const textRule = row.type === 'solid'
      ? `.score-rank-${row.rank}{background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;-webkit-text-fill-color:${row.color}!important;color:${row.color}!important;filter:none!important;}`
      : row.rank === 'sparkle-rainbow'
        ? `.score-rank-sparkle-rainbow{background-image:${textPaint}!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;color:transparent!important;}`
        : `.score-rank-${row.rank}{background:${textPaint}!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;color:transparent!important;filter:none!important;}`;

    const sparkleTextRule = row.rank === 'sparkle-rainbow'
      ? `.score-rank-sparkle-rainbow{` +
        `background-image:${textPaint},linear-gradient(110deg,transparent 30%,rgba(255,255,255,.15) 41%,#ffffff 49%,rgba(255,255,255,.22) 57%,transparent 69%)!important;` +
        `background-size:100% 100%,260% 100%!important;` +
        `background-position:0 0,180% 0;` +
        `background-repeat:no-repeat!important;` +
        `background-blend-mode:screen!important;` +
        `-webkit-background-clip:text!important;background-clip:text!important;` +
        `-webkit-text-fill-color:transparent!important;color:transparent!important;` +
        `filter:drop-shadow(0 0 .45px rgba(255,255,255,.32)) drop-shadow(0 0 1.2px rgba(236,72,153,.24));` +
        `animation:skill-sparkle-text-sweep var(--skill-sparkle-cycle,1.6s) linear infinite,skill-sparkle-text-glow var(--skill-sparkle-cycle,1.6s) ease-in-out infinite!important;}`
      : '';

    // 曲別Skillは数字を白で固定し、左右の帯だけをスキルカラーにする。
    // 左右帯は「上→下」の縦グラデーションに統一する。
    // 配色そのものは同じSKILL_COLOR_TABLEを参照。
    // background-position / background-size を使うため、単色もgradient image化する。
    // これで WHITE / ORANGE / YELLOW / GREEN / BLUE / PURPLE / RED など
    // 非グラデーション帯も、グラデーション帯と同じ左右カラー帯になる。
    const sidePaint = row.type === 'solid'
      ? `linear-gradient(180deg, ${row.color} 0%, ${row.color} 100%)`
      : skillColorVerticalCss(row);

    const songBoxRule =
      `.skill-box-${row.rank}{` +
      `--skill-side-paint:${sidePaint};` +
      `background-image:${sidePaint},${sidePaint}!important;` +
      `background-position:left top,right top!important;` +
      `background-size:5px 100%,5px 100%!important;` +
      `background-repeat:no-repeat,no-repeat!important;` +
      `background-color:#101827!important;` +
      `color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;` +
      `font-weight:900!important;` +
      `text-shadow:0 1px 2px rgba(0,0,0,.95)!important;` +
      `border-top:1px solid #334155!important;border-bottom:1px solid #334155!important;` +
      `border-left:0!important;border-right:0!important;` +
      `box-sizing:border-box!important;}` +
      `body.light-mode .skill-box-${row.rank}{` +
      `background-image:${sidePaint},${sidePaint}!important;` +
      `background-position:left top,right top!important;` +
      `background-size:5px 100%,5px 100%!important;` +
      `background-repeat:no-repeat,no-repeat!important;` +
      `background-color:#f3f4f6!important;` +
      `color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;` +
      `-webkit-text-stroke:.45px #111827!important;` +
      `text-shadow:0 1px 2px rgba(0,0,0,.9)!important;` +
      `border-top:1px solid #cbd5e1!important;border-bottom:1px solid #cbd5e1!important;` +
      `border-left:0!important;border-right:0!important;` +
      `box-sizing:border-box!important;}`;

    const sparkleBandRule = row.rank === 'sparkle-rainbow'
      ? `.skill-box-sparkle-rainbow{` +
        `background-image:${sidePaint},${sidePaint}!important;` +
        `background-position:left top,right top!important;` +
        `background-size:5px 100%,5px 100%!important;` +
        `background-repeat:no-repeat,no-repeat!important;` +
        `box-shadow:none!important;` +
        `filter:none!important;` +
        `animation:none!important;}` +
        `body.light-mode .skill-box-sparkle-rainbow{` +
        `background-image:${sidePaint},${sidePaint}!important;` +
        `background-position:left top,right top!important;` +
        `background-size:5px 100%,5px 100%!important;` +
        `background-repeat:no-repeat,no-repeat!important;` +
        `background-color:#f3f4f6!important;` +
        `filter:none!important;opacity:1!important;` +
        `box-shadow:none!important;` +
        `animation:none!important;}`
      : '';

    // スキル対象・登録曲の「外枠だけ」は170degグラデーションにする。
    // スキル値の左右帯、ヘッダー、共有画像には sidePaint をそのまま使うため影響しない。
    const borderPaint = row.type === 'solid'
      ? row.color
      : `linear-gradient(170deg, ${row.stops.map(([color,pos]) => `${color} ${pos}%`).join(', ')})`;

    const cardBorderRule =
      `.dc-card:has(.skill-box-${row.rank}){--song-skill-border:${borderPaint};}` +
      // 9500帯を含め、ライトモードもダークと同じ斜めグラデーション枠を使う。
      `body.light-mode .dc-card:has(.skill-box-${row.rank}){--song-skill-border:${borderPaint};}`;

    return textRule + sparkleTextRule + songBoxRule + sparkleBandRule + cardBorderRule;
  }).join('\n');

  document.head.appendChild(style);
}
installSkillColorCss();

export function skillColorCanvasVerticalPaint(ctx, row, left, top, width, height) {
  if (!row) return '#ffffff';

  // 単色ランクは画面表示と同じ完全な単色にする。
  // 白へのグラデーションは次の500刻みのグラデーション帯だけに適用する。
  if (row.type === 'solid') {
    return row.color;
  }

  const g = ctx.createLinearGradient(left, top, left, top + height);

  // 9500帯は9000帯の配色を維持しながら、帯と枠の内部に白い輝きを挟む。
  if (row.rank === 'sparkle-rainbow') {
    [
      ['#e60000', 0], ['#f05a00', .14], ['#ffffff', .22], ['#fff7c2', .245],
      ['#e6b800', .29], ['#12a936', .43], ['#00aeb5', .56], ['#ffffff', .63],
      ['#bfdbfe', .655], ['#1559e6', .72], ['#681fd1', .86], ['#bf16ad', 1]
    ].forEach(([color, pos]) => g.addColorStop(pos, color));
    return g;
  }

  row.stops.forEach(([color,pos]) => {
    g.addColorStop(Number(pos) / 100, color);
  });
  return g;
}

// 共有画像のユーザー名 / TOTAL用。
// 登録曲のRAINBOW外枠と同じ170deg相当の角度をCanvas上で再現する。
// 8500未満のグラデーションは従来どおり縦方向のままにする。
export function skillColorCanvasShareTextPaint(ctx, row, left, top, width, height) {
  if (!row) return '#ffffff';

  // 0・1000・2000…の単色帯は、画面表示と同じ完全な単色にする。
  // 白へのグラデーションを加えると、次の500刻みのグラデーション帯と
  // 同じ見た目になってしまう。
  if (row.type === 'solid') return row.color;

  if (!['rainbow', 'deep-rainbow', 'sparkle-rainbow'].includes(row.rank)) {
    return skillColorCanvasVerticalPaint(ctx, row, left, top, width, height);
  }

  const angleRad = 170 * Math.PI / 180;
  const directionX = Math.sin(angleRad);
  const directionY = -Math.cos(angleRad);
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const halfLength = (
    Math.abs(width * directionX) + Math.abs(height * directionY)
  ) / 2;
  const g = ctx.createLinearGradient(
    centerX - directionX * halfLength,
    centerY - directionY * halfLength,
    centerX + directionX * halfLength,
    centerY + directionY * halfLength
  );

  row.stops.forEach(([color,pos]) => {
    g.addColorStop(Number(pos) / 100, color);
  });
  return g;
}

export function drawSkillColorCanvasSparkle(ctx, centerX, centerY, size = 9, color = '#fff7c2') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.4, size * .14);
  ctx.shadowColor = color;
  ctx.shadowBlur = size * .75;
  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY);
  ctx.lineTo(centerX + size, centerY);
  ctx.moveTo(centerX, centerY - size);
  ctx.lineTo(centerX, centerY + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(1.2, size * .16), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawShareTotalSparkles(ctx, row, nameX, nameWidth, totalX, totalWidth, top, height) {
  if (row?.rank !== 'sparkle-rainbow') return;

  // ユーザー名とTOTAL値の周囲だけに、控えめな固定光点を描画する。
  drawSkillColorCanvasSparkle(ctx, nameX + Math.min(nameWidth * .18, 72), top + 5, 8, '#f5d0fe');
  drawSkillColorCanvasSparkle(ctx, totalX + totalWidth + 9, top + height * .22, 10, '#fef3c7');
  drawSkillColorCanvasSparkle(ctx, totalX + totalWidth * .72, top + height + 3, 6, '#bfdbfe');
}
