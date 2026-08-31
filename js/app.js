
/* === v21 FIX28: SINGLE SOURCE OF TRUTH / SKILL COLOR TABLE ===
   サイト表示・ユーザーリスト・共有画像は、すべてこのテーブルを参照する。
   配色を変更するときは原則ここだけ変更する。
*/
let adminEnabled = false;

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

const SKILL_COLOR_BY_RANK = Object.freeze(
  Object.fromEntries(SKILL_COLOR_TABLE.map(row => [row.rank, row]))
);

function getSkillColorRowByTotalValue(totalValue) {
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
      `.m-card:has(.skill-box-${row.rank}),` +
      `.sk-row:has(.skill-box-${row.rank}){--song-skill-border:${borderPaint};}` +
      // 9500帯を含め、ライトモードもダークと同じ斜めグラデーション枠を使う。
      `body.light-mode .m-card:has(.skill-box-${row.rank}),` +
      `body.light-mode .sk-row:has(.skill-box-${row.rank}){--song-skill-border:${borderPaint};}`;

    return textRule + sparkleTextRule + songBoxRule + sparkleBandRule + cardBorderRule;
  }).join('\n');

  document.head.appendChild(style);
}
installSkillColorCss();

function skillColorCanvasPaint(ctx, row, left, top, width, height) {
  if (!row) return '#ffffff';
  if (row.type === 'solid') return row.color;

  const horizontal = (row.direction || '90deg') === '90deg';
  const g = horizontal
    ? ctx.createLinearGradient(left, top, left + width, top)
    : ctx.createLinearGradient(left, top, left, top + height);

  row.stops.forEach(([color,pos]) => g.addColorStop(pos / 100, color));
  return g;
}

function skillColorCanvasVerticalPaint(ctx, row, left, top, width, height) {
  if (!row) return '#ffffff';

  const g = ctx.createLinearGradient(left, top, left, top + height);

  // 単色ランクも画面と同条件:
  // 上 = ランク色 / 下 = 白
  if (row.type === 'solid') {
    g.addColorStop(0, row.color);
    g.addColorStop(1, '#ffffff');
    return g;
  }

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
function skillColorCanvasShareTextPaint(ctx, row, left, top, width, height) {
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

function drawSkillColorCanvasSparkle(ctx, centerX, centerY, size = 9, color = '#fff7c2') {
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

function drawShareTotalSparkles(ctx, row, nameX, nameWidth, totalX, totalWidth, top, height) {
  if (row?.rank !== 'sparkle-rainbow') return;

  // ユーザー名とTOTAL値の周囲だけに、控えめな固定光点を描画する。
  drawSkillColorCanvasSparkle(ctx, nameX + Math.min(nameWidth * .18, 72), top + 5, 8, '#f5d0fe');
  drawSkillColorCanvasSparkle(ctx, totalX + totalWidth + 9, top + height * .22, 10, '#fef3c7');
  drawSkillColorCanvasSparkle(ctx, totalX + totalWidth * .72, top + height + 3, 6, '#bfdbfe');
}
import { supabase } from './supabase.js?v=21_57';
import { register, login, loginForAccountSwitch, logout, changePassword, getSession, validateUsername } from './auth.js?v=4_1_2';
import { initAuthCaptcha, prepareAuthCaptcha, getAuthCaptchaToken, resetAuthCaptcha } from './captcha.js?v=21_84';
import { PARTS, GF_PARTS, DM_PARTS, partsForInstrument, normalizeSongTitleForMatch, searchSongTitles, getSongByTitleAndPart, requestSongMaster, requestSongLevelCorrection } from './songs.js?v=4_12_7';
import { calcSkill, formatLevel, formatRate, formatSkill, getMyScores, saveScore, deleteScore } from './scores.js?v=3_18_4';
import { getGameVersions } from './versions.js?v=21_57';
const {
  isAdmin,
  getAdminSongs,
  getAdminSongMasterPage,
  saveMasterSong,
  deleteMasterSong,
  getAdminUsers,
  getAdminFeatureSettingUsage,
  getPendingSongRequests,
  approveSongRequest,
  rejectSongRequest,
  accountAdmin,
  getAdminSongPickerChoices,
  saveMasterSongRows,
  createGameVersion,
  getAdminSongIdentities,
  getAdminSongIdentitiesByIds
} = adminApi;

// 曲マスター表の列順。admin.jsが古くても画面自体は起動できるようローカルにも保持。
const MASTER_PARTS = adminApi.MASTER_PARTS ?? [
  'MAS-G','MAS-B','MAS-D','EXT-G','EXT-B','EXT-D','ADV-G','ADV-B','ADV-D','BSC-G','BSC-B','BSC-D'
];
const MASTER_CSV_HEADERS = [
  '曲ID', '曲名', 'ふりがな', 'ふりがな種別', 'ふりがな確認済み', 'HOT', ...MASTER_PARTS
];

const EAMUSEMENT_ORIGIN = 'https://p.eagate.573.jp';
function getEamusementSlug() {
  return activeVersion?.eamusement_slug || 'gitadora_galaxywave_delta';
}
function getEamusementSyncEntry() {
  return `https://p.eagate.573.jp/game/gfdm/${getEamusementSlug()}/p/playdata/skill.html?gtype=gf&stype=1`;
}
let skillSyncInProgress = false;
const SKILL_SYNC_CHUNK_SIZE = 25;

function setSkillSyncStatus(message, state = '') {
  const el = $('skillSyncStatus');
  if (!el) return;
  el.textContent = String(message || '');
  el.className = `skill-sync-status ${state}`.trim();
}

function buildSkillSyncBookmarklet() {
  // 同期本体は外部JS側。ブックマークレットは読み込みだけにして最短化する。
  return "javascript:void(!function(d){var s=d.createElement('script');s.src='https://gitadorafc.github.io/skillsimulator/js/eamusement-sync.js?t='+Date.now();d.head.appendChild(s)}(document))";
}

function captureSkillSyncHash() {
  if (!location.hash.startsWith('#skill-sync=')) return;
  try {
    const raw = decodeURIComponent(location.hash.slice('#skill-sync='.length));
    const payload = JSON.parse(raw);
    sessionStorage.setItem('gitadora_pending_skill_sync', JSON.stringify(payload));
  } catch (e) {
    console.error('skill sync hash parse error', e);
  } finally {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

async function recordMyActivity(eventType = 'OPEN') {
  try {
    const { error } = await supabase.rpc('record_my_activity', {
      p_event: String(eventType || 'OPEN').toUpperCase()
    });
    if (error) throw error;
  } catch (e) {
    // 集計用の記録失敗で、画面表示・同期・手動登録を止めない。
    console.warn('activity record failed:', e);
  }
}

async function importSkillSyncRecords(payload) {
  if (skillSyncInProgress) return;
  renderSkillSyncBrowserGuide();
  $('skillSyncMask').style.display = 'flex';

  const payloadSlug = String(payload?.eamusement_slug || '').trim();
  if (payloadSlug) {
    const payloadVersion = gameVersions.find(version => version.eamusement_slug === payloadSlug);
    if (!payloadVersion) {
      setSkillSyncStatus('取得したGITADORAバージョンは、このアプリにまだ登録されていません。', 'error');
      return;
    }

    // 公式サイト側で取得したVERSIONを正とし、保存先の取り違えを防ぐ。
    if (payloadVersion.id !== activeVersionId) {
      await switchGameVersion(payloadVersion.id);
      $('versionSelect').value = payloadVersion.id;
    }
  }

  const records = Array.isArray(payload?.records) ? payload.records : [];
  if (!records.length) {
    setSkillSyncStatus('同期データを取得できませんでした。e-amusementへのログイン状態を確認してください。', 'error');
    return;
  }

  const unique = new Map();
  for (const row of records) {
    const title = String(row?.title || '').trim();
    const part = String(row?.part || '');
    const rate = Number(row?.rate);
    const level = Number(row?.level);
    const category = String(row?.category || '').toUpperCase() === 'HOT' ? 'HOT' : 'OTHER';

    if (!title || !PARTS.includes(part)) continue;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) continue;
    if (!Number.isFinite(level) || level <= 0 || level > 99.99) continue;

    unique.set(`${normalizeSongTitleForMatch(title)}\u0000${part}`, {
      title,
      part,
      // 公式ページの表示値は小数第2位まで確定済み。
      // Math.floorでは80.71が浮動小数誤差で80.70になるため、表示桁へ正規化する。
      rate: Number(rate.toFixed(2)),
      level: Number(level.toFixed(2)),
      category
    });
  }

  const rows = [...unique.values()];
  if (!rows.length) {
    setSkillSyncStatus('有効な同期データがありませんでした。', 'error');
    return;
  }

  skillSyncInProgress = true;
  $('skillSyncMask').style.display = 'flex';
  let completionMessage = '';

  try {
    let saved = 0;
    let requested = 0;
    let skipped = 0;

    // 100件前後を1回のRPCで処理すると、ユーザーの過去データ量によっては
    // DBの制限時間を超えるため、小分けにして順番に保存する。
    // 同じデータを再同期しても既存行は更新されるため、途中失敗後の再実行も安全。
    for (let offset = 0; offset < rows.length; offset += SKILL_SYNC_CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + SKILL_SYNC_CHUNK_SIZE);
      const end = offset + chunk.length;
      setSkillSyncStatus(`同期中… ${offset + 1}〜${end} / ${rows.length}件`, 'running');

      const { data, error } = await supabase.rpc('sync_skill_records', {
        p_records: chunk,
        p_version_id: activeVersionId,
        p_default_gf_option: getGfDefaultOption()
      });

      if (error) {
        const chunkError = new Error(`${offset + 1}〜${end}件目の保存に失敗しました：${error.message || error}`);
        chunkError.cause = error;
        throw chunkError;
      }

      const result = Array.isArray(data) ? data[0] : data;
      saved += Number(result?.saved_count) || 0;
      requested += Number(result?.requested_count) || 0;
      skipped += Number(result?.skipped_count) || 0;
    }

    await recordMyActivity('SYNC');
    await loadScores();

    const countText = payload?.counts
      ? `GF HOT ${payload.counts.GF_HOT ?? 0} / GF OTHER ${payload.counts.GF_OTHER ?? 0} / DM HOT ${payload.counts.DM_HOT ?? 0} / DM OTHER ${payload.counts.DM_OTHER ?? 0}`
      : `${rows.length}件`;

    completionMessage =
      `取得: ${countText}\n` +
      `登録・更新: ${saved}件　登録依頼: ${requested}件${skipped ? `　スキップ: ${skipped}件` : ''}`;
    setSkillSyncStatus(`同期完了\n${completionMessage}`, 'success');
  } catch (e) {
    console.error(e);
    setSkillSyncStatus(`同期に失敗しました: ${e?.message || e}`, 'error');
  } finally {
    skillSyncInProgress = false;
  }

  if (completionMessage) {
    // 同期完了後は設定画面を残さず、メインのスキル対象TOPへ戻す。
    $('skillSyncMask').style.display = 'none';
    $('menuMask').style.display = 'none';
    closeModal();
    closeRateComparison();
    closeUserDetail();
    switchTab('SKILL');
    scrollMainPageTo(0);
    await showSiteDialog(completionMessage, '同期完了');
  }
}

async function processPendingSkillSync() {
  const raw = sessionStorage.getItem('gitadora_pending_skill_sync');
  if (!raw) return;
  sessionStorage.removeItem('gitadora_pending_skill_sync');
  try {
    await importSkillSyncRecords(JSON.parse(raw));
  } catch (e) {
    console.error(e);
    setSkillSyncStatus(`同期に失敗しました: ${e?.message || e}`, 'error');
  }
}

// v14.3: 曲マスターの横一括編集はapp.js側にも実装。
// admin.jsのキャッシュや差し替え漏れがあっても保存できるようにする。
async function saveMasterSongRow({
  originalTitle = '',
  title,
  reading = '',
  isHot = false,
  levels = {}
}) {
  return saveMasterSongRows([{
    originalTitle,
    title,
    reading,
    isHot,
    levels
  }], activeVersionId);
}

function collectMasterSongRow(tr) {
  const levels = {};
  MASTER_PARTS.forEach(part => {
    levels[part] = tr.querySelector(`[data-master-level="${part}"]`)?.value ?? '';
  });

  const reading = tr.querySelector('[data-master-reading]')?.value || '';
  const originalReading = tr.dataset.originalReading || '';
  const readingChanged = reading.trim() !== originalReading.trim();
  const readingReviewed = Boolean(
    tr.querySelector('[data-master-reading-reviewed]')?.checked
  );

  return {
    originalTitle: tr.dataset.originalTitle || '',
    title: tr.querySelector('[data-master-title]')?.value || '',
    reading,
    readingSource: reading.trim()
      ? (readingChanged ? 'MANUAL' : (tr.dataset.readingSource || 'MANUAL'))
      : 'NONE',
    readingReviewed: reading.trim()
      ? (readingChanged || readingReviewed)
      : false,
    isHot: Boolean(tr.querySelector('[data-master-hot]')?.checked),
    levels
  };
}

async function saveVisibleMasterSongs() {
  const rows = Array.from(
    $('adminBody').querySelectorAll('tr[data-master-row]')
  ).map(collectMasterSongRow);

  if (!rows.length) throw new Error('保存対象の曲がありません。');

  const savedCount = await saveMasterSongRows(rows, activeVersionId);
  adminSongPickerKey = '';
  adminSongPickerChoices = [];
  await loadAdminSongs();
  return savedCount;
}

async function loadAllAdminMasterRows(versionId) {
  const rows = [];
  const pageSize = 200;

  for (let page = 0; ; page += 1) {
    const result = await getAdminSongMasterPage('', page, pageSize, versionId, '', '');
    rows.push(...result.rows);
    if (rows.length >= result.total || result.rows.length < pageSize) break;
  }

  return rows;
}

function csvEscape(value) {
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

function parseMasterCsv(text) {
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
  const partColumns = new Map(MASTER_PARTS.map(part => [part, findColumn(part)]));

  if (idColumn < 0) throw new Error('「曲ID」列がありません。');
  if (titleColumn < 0 && !MASTER_PARTS.some(part => partColumns.get(part) >= 0)) {
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

    MASTER_PARTS.forEach(part => {
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

async function buildMasterImportRows(parsedRows, targetVersionId, allowSourceVersionIds = false) {
  const [targetRows, targetIdentities, requestedIdentities] = await Promise.all([
    loadAllAdminMasterRows(targetVersionId),
    getAdminSongIdentities(targetVersionId),
    getAdminSongIdentitiesByIds(parsedRows.map(row => row.songId).filter(Boolean))
  ]);

  const targetRowsByTitle = new Map(targetRows.map(row => [row.title, row]));
  const targetIdentityById = new Map(targetIdentities.map(row => [row.id, row]));
  const requestedIdentityById = new Map(requestedIdentities.map(row => [row.id, row]));
  const sourceVersionMaps = new Map();

  if (allowSourceVersionIds) {
    const sourceVersionIds = [...new Set(
      requestedIdentities
        .map(row => row.version_id)
        .filter(versionId => versionId && versionId !== targetVersionId)
    )];
    for (const versionId of sourceVersionIds) {
      const sourceRows = await loadAllAdminMasterRows(versionId);
      sourceVersionMaps.set(versionId, new Map(sourceRows.map(row => [row.title, row])));
    }
  }

  return parsedRows.map(row => {
    let identity = null;
    let baseline = null;
    let targetBaseline = null;

    if (row.songId) {
      identity = targetIdentityById.get(row.songId) || requestedIdentityById.get(row.songId);
      if (!identity) throw new Error(`${row.rowNumber}行目の曲IDが見つかりません。`);
      if (identity.version_id !== targetVersionId && !allowSourceVersionIds) {
        throw new Error(`${row.rowNumber}行目の曲IDは選択したバージョンのものではありません。`);
      }

      targetBaseline = targetRowsByTitle.get(identity.title) || null;
      baseline = targetBaseline;
      if (!baseline && allowSourceVersionIds) {
        baseline = sourceVersionMaps.get(identity.version_id)?.get(identity.title) || null;
      }
      if (!baseline) throw new Error(`${row.rowNumber}行目の曲IDに対応する曲データがありません。`);
    } else {
      if (targetRowsByTitle.has(row.title)) {
        throw new Error(`${row.rowNumber}行目は曲IDが空欄ですが、同名曲がすでに存在します。`);
      }
    }

    const title = row.title ?? baseline?.title ?? '';
    const reading = row.reading ?? baseline?.reading ?? '';
    const readingChanged = row.reading != null && row.reading !== (baseline?.reading ?? '');
    const readingSource = row.readingSource
      ?? (readingChanged ? 'MANUAL' : (baseline?.reading_source || (reading ? 'MANUAL' : 'NONE')));
    const readingReviewed = row.readingReviewed
      ?? (readingChanged ? true : Boolean(baseline?.reading_reviewed));
    const isHot = row.isHot ?? Boolean(baseline?.is_hot);
    const levels = {};

    MASTER_PARTS.forEach(part => {
      const incoming = row.levels[part];
      levels[part] = incoming == null
        ? (baseline?.levels?.[part] != null ? formatLevel(baseline.levels[part]) : '')
        : incoming;
    });

    if (!title) throw new Error(`${row.rowNumber}行目の曲名がありません。`);
    if (!MASTER_PARTS.some(part => String(levels[part] ?? '').trim() !== '')) {
      throw new Error(`${row.rowNumber}行目は全難易度が空になります。`);
    }

    return {
      originalTitle: targetBaseline?.title || '',
      title,
      reading,
      readingSource,
      readingReviewed,
      isHot,
      levels
    };
  });
}

async function downloadAdminMasterCsv() {
  const button = $('btnAdminCsvDownload');
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = '作成中...';

    const [rows, identities] = await Promise.all([
      loadAllAdminMasterRows(activeVersionId),
      getAdminSongIdentities(activeVersionId)
    ]);
    const representativeIdByTitle = new Map();
    identities.forEach(row => {
      if (!representativeIdByTitle.has(row.title)) representativeIdByTitle.set(row.title, row.id);
    });

    const lines = [MASTER_CSV_HEADERS.map(csvEscape).join(',')];
    rows.forEach(row => {
      const values = [
        representativeIdByTitle.get(row.title) || '',
        row.title,
        row.reading || '',
        row.reading_source || 'NONE',
        row.reading_reviewed ? '1' : '0',
        row.is_hot ? '1' : '0',
        ...MASTER_PARTS.map(part => row.levels?.[part] != null ? formatLevel(row.levels[part]) : '')
      ];
      lines.push(values.map(csvEscape).join(','));
    });

    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code = String(activeVersion?.code || 'VERSION').replace(/[^A-Z0-9_-]/gi, '_');
    anchor.href = url;
    anchor.download = `gitadora_song_master_${code}_${date}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await showSiteDialog(`${rows.length}曲のCSVをダウンロードしました。`, 'CSV作成完了');
  } catch (error) {
    await showSiteDialog('CSVの作成に失敗しました: ' + error.message, 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderAdminCsvVersionOptions() {
  const select = $('adminCsvVersion');
  select.innerHTML = [
    ...gameVersions.map(version => `
      <option value="${version.id}">
        ${esc(version.name)}${version.is_current ? '（最新版）' : ''}
      </option>`),
    '<option value="__NEW__">＋ 新しいバージョンを追加</option>'
  ].join('');
  select.value = activeVersionId;
  toggleAdminCsvNewVersionFields();
}

function toggleAdminCsvNewVersionFields() {
  const isNew = $('adminCsvVersion').value === '__NEW__';
  $('adminCsvNewVersionFields').classList.toggle('hidden', !isNew);
}

function openAdminCsvUpload() {
  renderAdminCsvVersionOptions();
  $('adminCsvFile').value = '';
  $('adminCsvCode').value = '';
  $('adminCsvName').value = '';
  $('adminCsvSlug').value = '';
  $('adminCsvMakeCurrent').checked = true;
  $('adminCsvStatus').textContent = '';
  $('adminCsvMask').style.display = 'flex';
}

function closeAdminCsvUpload() {
  $('adminCsvMask').style.display = 'none';
}

async function importAdminMasterCsv() {
  const file = $('adminCsvFile').files?.[0];
  if (!file) throw new Error('アップロードするCSVを選択してください。');

  const parsedRows = parseMasterCsv(await file.text());
  const creatingVersion = $('adminCsvVersion').value === '__NEW__';
  const targetLabel = creatingVersion
    ? ($('adminCsvName').value.trim() || '新しいバージョン')
    : gameVersions.find(version => version.id === $('adminCsvVersion').value)?.name;
  const confirmed = await showSiteConfirm(
    `${targetLabel}へ${parsedRows.length}曲を追加・更新します。\nCSVに含まれない曲と、空欄の項目は変更しません。`,
    '曲マスターCSV取込',
    '取込を開始'
  );
  if (!confirmed) return;

  let targetVersionId = $('adminCsvVersion').value;
  if (creatingVersion) {
    const created = await createGameVersion({
      code: $('adminCsvCode').value,
      name: $('adminCsvName').value,
      eamusementSlug: $('adminCsvSlug').value,
      makeCurrent: $('adminCsvMakeCurrent').checked
    });
    if (!created?.id) throw new Error('新しいバージョンを追加できませんでした。');
    targetVersionId = created.id;
  }

  const mergedRows = await buildMasterImportRows(parsedRows, targetVersionId, creatingVersion);
  const chunkSize = 50;
  let saved = 0;

  for (let index = 0; index < mergedRows.length; index += chunkSize) {
    const chunk = mergedRows.slice(index, index + chunkSize);
    $('adminCsvStatus').textContent = `${saved} / ${mergedRows.length}曲を処理済み`;
    try {
      await saveMasterSongRows(chunk, targetVersionId);
      saved += chunk.length;
    } catch (error) {
      throw new Error(`${saved}曲処理後に停止しました。${error.message}`);
    }
  }

  if (creatingVersion) await loadGameVersionOptions();
  if (targetVersionId !== activeVersionId) {
    await switchGameVersion(targetVersionId);
    $('versionSelect').value = targetVersionId;
  } else {
    adminSongPage = 0;
    await loadAdminSongs();
  }

  adminSongPickerKey = '';
  adminSongPickerChoices = [];
  closeAdminCsvUpload();
  await showSiteDialog(`${saved}曲を追加・更新しました。`, 'CSV取込完了');
}

async function deleteMasterSongTitle(title) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return;

  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('title', cleanTitle)
    .eq('version_id', activeVersionId);

  if (error) throw error;
}

import * as adminApi from './admin.js?v=4_13_12';
import { listUserSummaries, getUserSkillTargets, getSongRateComparison, getSongPersonalBestHistory, getSongOptionDistribution, getMyFavorites, addFavorite, removeFavorite } from './users.js?v=3_6_0';

let activeInstrument = localStorage.getItem('gitadora_instrument') === 'DM' ? 'DM' : 'GF';
let userListSort = { key: activeInstrument === 'DM' ? 'dm' : 'gf', dir: 'desc' };
const USER_LIST_PAGE_SIZE = 30;
let userListPage = 0;
let activeTabName = 'SKILL';
let gameVersions = [];
let activeVersionId = localStorage.getItem('gitadora_version_id') || null;
let activeVersion = null;
let currentAuthMode = 'login';
let scores = [];
let editingScoreId = null;
let selectedSong = null;
let scoreModalScrollY = 0;
let rateComparisonEditScoreId = null;

let adminAccessChecked = false;
let primaryAdminEnabled = false;
let adminTab = 'songs';
let adminSongs = [];
let adminUsers = [];
let adminUserSort = { key: 'created_at', dir: 'desc' };
let adminSongPage = 0;
const ADMIN_SONG_PAGE_SIZE = 100;
let adminRequests = [];
let adminFeedback = [];
let adminEditingSongId = null;
let adminNewSongRowVisible = false;
let adminSongPickerChoices = [];
let adminSongPickerKey = '';
let publicUsers = [];
let favoriteUsers = { GF: [], DM: [] };
let viewedUserScores = [];
let currentUserId = null;
let viewedUserId = null;
let viewedUserName = '';
let viewedUserProfile = null;
let viewedUserRegisteredScores = [];
const REGISTERED_RECORD_BATCH_SIZE = 50;
const REGISTERED_RECORD_COLUMN_BATCH_SIZE = 25;
let ownRegisteredBatch = 1;
let ownRegisteredViewKey = '';
let viewedUserRegisteredBatch = 1;
let adminPasswordUserId = null;

const $ = id => document.getElementById(id);

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

function adminSongInitialGroup(value) {
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

function adminSongCategory(row) {
  const reading = String(row?.reading || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();
  if (reading) return adminSongInitialGroup(reading);

  const title = String(row?.title || '').normalize('NFKC').trim();
  if (isKanjiFirstCharacter(title)) return 'unclassified';
  return adminSongInitialGroup(title);
}

function renderAdminSongPickerCandidates() {
  const initialSelect = $('adminSongInitialFilter');
  const songSelect = $('adminSongCandidate');
  if (!initialSelect || !songSelect) return;

  const group = initialSelect.value;
  const currentTitle = $('formTitle')?.value || '';

  if (!group) {
    songSelect.innerHTML = '<option value="">頭文字を選択してください</option>';
    songSelect.disabled = true;
    return;
  }

  const rows = adminSongPickerChoices
    .filter(row => group === 'new'
      ? row.isHot
      : adminSongCategory(row) === group)
    .sort((a, b) => {
      const aKey = a.reading || a.title;
      const bKey = b.reading || b.title;
      return aKey.localeCompare(bKey, 'ja', { numeric:true, sensitivity:'base' }) ||
        a.title.localeCompare(b.title, 'ja', { numeric:true, sensitivity:'base' });
    });

  songSelect.innerHTML = `
    <option value="">選択してください（${rows.length}曲）</option>
    ${rows.map(row => `<option value="${esc(row.title)}">${esc(row.title)}</option>`).join('')}`;
  songSelect.value = rows.some(row => row.title === currentTitle) ? currentTitle : '';
  songSelect.disabled = rows.length === 0;
}

async function prepareAdminSongPicker() {
  const picker = $('adminSongPicker');
  if (!picker) return;

  picker.classList.remove('hidden');
  if (!activeVersionId) return;

  const key = `${activeVersionId}:${activeInstrument}`;
  if (adminSongPickerKey === key && adminSongPickerChoices.length) {
    renderAdminSongPickerCandidates();
    return;
  }

  const songSelect = $('adminSongCandidate');
  if (songSelect) {
    songSelect.disabled = true;
    songSelect.innerHTML = '<option value="">曲名を読み込み中...</option>';
  }

  try {
    const rows = await getAdminSongPickerChoices(activeVersionId, activeInstrument);
    if (`${activeVersionId}:${activeInstrument}` !== key) return;
    adminSongPickerChoices = rows;
    adminSongPickerKey = key;
    renderAdminSongPickerCandidates();
  } catch (error) {
    console.error('曲名候補の取得に失敗:', error);
    if (songSelect) {
      songSelect.disabled = true;
      songSelect.innerHTML = '<option value="">候補を取得できません</option>';
    }
  }
}

let globalModalScrollY = 0;
let globalModalScrollLocked = false;
let globalModalUsedAppScroller = false;
let appScrollEndTimer = null;

const GLOBAL_SCROLL_LOCK_OVERLAYS = [
  '#menuMask',
  '#featureSettingsMask',
  '#feedbackMask',
  '#supportMask',
  '#howToMask',
  '#rivalManageMask',
  '#mypageModal',
  '#skillSyncMask',
  '#skillShareMask',
  '#skillHistoryMask',
  '#accountSwitchMask',
  '#rateCompareMask',
  '#siteDialogMask',
  '#adminModal',
  '#adminSongFormMask',
  '#adminPasswordMask'
];

function isOverlayVisible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

function hasVisibleGlobalOverlay() {
  return GLOBAL_SCROLL_LOCK_OVERLAYS.some(selector =>
    isOverlayVisible(document.querySelector(selector))
  );
}

function getAppScroller() {
  if (!document.body.classList.contains('app-scroll-layout')) return null;
  return document.querySelector('#appScreen > .p-container');
}

function getMainPageScrollTop() {
  const scroller = getAppScroller();
  return scroller
    ? scroller.scrollTop
    : (window.scrollY || window.pageYOffset || 0);
}

function scrollMainPageTo(top, behavior = 'auto') {
  const nextTop = Math.max(0, Number(top) || 0);
  const scroller = getAppScroller();
  if (scroller) {
    scroller.scrollTo({ top:nextTop, left:0, behavior });
    return;
  }
  window.scrollTo({ top:nextTop, left:0, behavior });
}

function markAppScrolling() {
  if (!document.body.classList.contains('app-scroll-layout')) return;
  document.body.classList.add('app-scrolling');
  clearTimeout(appScrollEndTimer);
  appScrollEndTimer = setTimeout(() => {
    document.body.classList.remove('app-scrolling');
  }, 100);
}

function syncUserListHeaderVisibility() {
  const slot = $('userListHeaderSlot');
  if (!slot) return;
  const visible = document.body.classList.contains('app-scroll-layout') &&
    activeTabName === 'USERS';
  slot.classList.toggle('hidden', !visible);
}

function applyAppScrollLayout(enabled) {
  const shouldEnable = Boolean(enabled);
  const wasEnabled = document.body.classList.contains('app-scroll-layout');
  if (shouldEnable === wasEnabled) {
    syncUserListHeaderVisibility();
    return;
  }

  const previousTop = getMainPageScrollTop();
  document.documentElement.classList.toggle('app-scroll-layout', shouldEnable);
  document.body.classList.toggle('app-scroll-layout', shouldEnable);
  syncUserListHeaderVisibility();
  if (!shouldEnable) {
    clearTimeout(appScrollEndTimer);
    document.body.classList.remove('app-scrolling');
  }

  if (shouldEnable) {
    window.scrollTo({ top:0, left:0, behavior:'auto' });
  }

  requestAnimationFrame(() => {
    if (shouldEnable) {
      getAppScroller()?.scrollTo({ top:previousTop, left:0, behavior:'auto' });
    } else if (!$('appScreen').classList.contains('hidden')) {
      window.scrollTo({ top:previousTop, left:0, behavior:'auto' });
    }
    syncAppStickyHeaderHeight();
  });
}

function lockMainPageScroll() {
  // スコア登録モーダルは既存のiOS Safari専用ロック処理を使用する。
  if (document.body.classList.contains('score-modal-open')) return;
  if (globalModalScrollLocked) return;

  const appScroller = getAppScroller();
  globalModalScrollY = getMainPageScrollTop();
  globalModalUsedAppScroller = Boolean(appScroller);
  globalModalScrollLocked = true;

  document.body.classList.add('global-modal-scroll-lock');
  if (globalModalUsedAppScroller) return;

  document.body.style.position = 'fixed';
  document.body.style.top = `-${globalModalScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockMainPageScroll() {
  if (!globalModalScrollLocked) return;

  globalModalScrollLocked = false;
  document.body.classList.remove('global-modal-scroll-lock');

  const usedAppScroller = globalModalUsedAppScroller;
  globalModalUsedAppScroller = false;

  // スコア登録モーダルが開いている場合は、そちらの固定を壊さない。
  if (document.body.classList.contains('score-modal-open')) return;

  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';

  if (usedAppScroller && getAppScroller()) {
    getAppScroller().scrollTo({ top:globalModalScrollY, left:0, behavior:'auto' });
  } else {
    window.scrollTo({ top:globalModalScrollY, left:0, behavior:'auto' });
  }
}

function syncGlobalModalScrollLock() {
  if (hasVisibleGlobalOverlay()) {
    lockMainPageScroll();
  } else {
    unlockMainPageScroll();
  }
}

function syncAppStickyHeaderHeight() {
  const header = document.querySelector('.p-header');
  if (!header) return;
  const height = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--app-sticky-header-height', `${height}px`);
}

function scrollUserListPageToTop() {
  if (getAppScroller()) {
    scrollMainPageTo(0);
    return;
  }

  const sticky = document.querySelector('.user-list-sticky');
  const header = document.querySelector('.p-header');
  const firstRow = document.querySelector('#userList .user-list-row');
  if (!sticky || !header || !firstRow) return;

  const stickyHeight = Math.ceil(sticky.getBoundingClientRect().height);
  const stickyTopGap = 6;
  const headerHeight = Math.ceil(header.getBoundingClientRect().height);

  // 現在どこまでスクロールしていても、
  // 新しいページの1人目が「検索窓＋並び替え欄」の直下に来るよう絶対位置で補正する。
  const desiredFirstRowTop = headerHeight + stickyTopGap + stickyHeight;
  const currentFirstRowTop = firstRow.getBoundingClientRect().top;
  const currentScrollTop = window.scrollY || window.pageYOffset || 0;
  const targetY = Math.max(
    0,
    currentScrollTop + currentFirstRowTop - desiredFirstRowTop
  );

  scrollMainPageTo(targetY);

  // iPhone Safariでレイアウト確定が1フレーム遅れる場合の最終補正。
  requestAnimationFrame(() => {
    const correction = firstRow.getBoundingClientRect().top - desiredFirstRowTop;
    if (Math.abs(correction) > 1) {
      scrollMainPageTo(getMainPageScrollTop() + correction);
    }
  });
}


const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }


function applyLightMode(enabled = null) {
  const isLight = enabled == null
    ? localStorage.getItem('gitadora_light_mode') === '1'
    : Boolean(enabled);

  document.documentElement.classList.toggle('light-mode', isLight);
  document.body.classList.toggle('light-mode', isLight);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    isLight ? '#f8fafc' : '#111827'
  );
  return isLight;
}

const DISPLAY_CUSTOMIZATION_KEYS = Object.freeze({
  skillTargetColumns: 'gitadora_skill_target_columns',
  textSizeUp: 'gitadora_text_size_up'
});

const GF_DEFAULT_OPTIONS = Object.freeze(['NORMAL','RAN','SRA','RAN+','SRA+']);
const GF_DEFAULT_OPTION_STORAGE_PREFIX = 'gitadora_gf_default_option:';

function getGfDefaultOptionStorageKey() {
  return `${GF_DEFAULT_OPTION_STORAGE_PREFIX}${currentUserId || 'anonymous'}`;
}

function getGfDefaultOption() {
  const value = localStorage.getItem(getGfDefaultOptionStorageKey()) || 'NORMAL';
  return GF_DEFAULT_OPTIONS.includes(value) ? value : 'NORMAL';
}

function setGfDefaultOption(value) {
  const normalized = GF_DEFAULT_OPTIONS.includes(value) ? value : 'NORMAL';
  localStorage.setItem(getGfDefaultOptionStorageKey(), normalized);
  return normalized;
}

function readLocalDisplaySettings() {
  return {
    lightMode: localStorage.getItem('gitadora_light_mode') === '1',
    skillTargetColumns:
      localStorage.getItem(DISPLAY_CUSTOMIZATION_KEYS.skillTargetColumns) === '1',
    textSizeUp:
      localStorage.getItem(DISPLAY_CUSTOMIZATION_KEYS.textSizeUp) === '1',
    gfDefaultOption: getGfDefaultOption()
  };
}

function writeLocalDisplaySettings(settings) {
  const lightMode = Boolean(settings?.lightMode);
  const skillTargetColumns = Boolean(settings?.skillTargetColumns);
  const textSizeUp = Boolean(settings?.textSizeUp);
  const gfDefaultOption = setGfDefaultOption(
    settings?.gfDefaultOption || 'NORMAL'
  );

  localStorage.setItem('gitadora_light_mode', lightMode ? '1' : '0');
  localStorage.setItem(
    DISPLAY_CUSTOMIZATION_KEYS.skillTargetColumns,
    skillTargetColumns ? '1' : '0'
  );
  localStorage.setItem(
    DISPLAY_CUSTOMIZATION_KEYS.textSizeUp,
    textSizeUp ? '1' : '0'
  );

  applyLightMode(lightMode);
  applyDisplayCustomization(skillTargetColumns, textSizeUp);

  return {
    lightMode,
    skillTargetColumns,
    textSizeUp,
    gfDefaultOption
  };
}

async function saveMyDisplaySettingsToSupabase(settings) {
  const normalized = {
    lightMode: Boolean(settings?.lightMode),
    skillTargetColumns: Boolean(settings?.skillTargetColumns),
    textSizeUp: Boolean(settings?.textSizeUp),
    gfDefaultOption: GF_DEFAULT_OPTIONS.includes(settings?.gfDefaultOption)
      ? settings.gfDefaultOption
      : 'NORMAL'
  };

  const { error } = await supabase.rpc('set_my_display_settings', {
    p_light_mode: normalized.lightMode,
    p_skill_target_columns: normalized.skillTargetColumns,
    p_text_size_up: normalized.textSizeUp,
    p_gf_default_option: normalized.gfDefaultOption
  });
  if (error) throw error;
  return normalized;
}

async function syncMyDisplaySettings() {
  if (!currentUserId) return readLocalDisplaySettings();

  const localSettings = readLocalDisplaySettings();

  try {
    const { data, error } = await supabase.rpc('get_my_display_settings');
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    // 初回だけ現在の端末設定をSupabaseへ移行する。
    // DBの初期値で既存設定を上書きしない。
    if (!row?.has_settings) {
      await saveMyDisplaySettingsToSupabase(localSettings);
      return writeLocalDisplaySettings(localSettings);
    }

    // 移行後はSupabaseを正として別端末にも同じ設定を反映する。
    return writeLocalDisplaySettings({
      lightMode: Boolean(row.light_mode),
      skillTargetColumns: Boolean(row.skill_target_columns),
      textSizeUp: Boolean(row.text_size_up),
      gfDefaultOption: row.gf_default_option || 'NORMAL'
    });
  } catch (error) {
    // SQL未適用時や一時的な通信障害でも従来の端末設定で利用を継続する。
    console.warn('表示設定のSupabase同期に失敗しました:', error);
    return writeLocalDisplaySettings(localSettings);
  }
}

function applyDisplayCustomization(skillTargetColumns = null, textSizeUp = null) {
  const columnsEnabled = (
    skillTargetColumns == null
      ? localStorage.getItem(DISPLAY_CUSTOMIZATION_KEYS.skillTargetColumns) === '1'
      : Boolean(skillTargetColumns)
  );
  const textSizeEnabled = (
    textSizeUp == null
      ? localStorage.getItem(DISPLAY_CUSTOMIZATION_KEYS.textSizeUp) === '1'
      : Boolean(textSizeUp)
  );

  // 対象コンテナ側で表示中かを判定するため、設定値は他ユーザー画面でも維持する。
  document.body.classList.toggle('skill-target-columns', columnsEnabled);
  document.body.classList.toggle('text-size-up', textSizeEnabled);

  return {
    skillTargetColumns: columnsEnabled,
    textSizeUp: textSizeEnabled
  };
}

async function getMyFeatureSettings() {
  const { data, error } = await supabase.rpc('get_my_feature_settings');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || {
    registration_public: false,
    x_public: false,
    x_id: null
  };
}

async function getUserPublicProfile(userId) {
  const { data, error } = await supabase.rpc('get_public_user_profile', {
    p_user_id: userId
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || {
    registration_public: false,
    x_public: false,
    x_id: null
  };
}

async function getPublicUserRegisteredScores(userId, instrument = activeInstrument, versionId = activeVersionId) {
  const { data, error } = await supabase.rpc('get_public_user_registered_scores', {
    p_user_id: userId,
    p_instrument: instrument,
    p_version_id: versionId
  });
  if (error) throw error;
  return data ?? [];
}

function normalizeXIdInput(value) {
  let text = String(value || '').trim();
  if (!text) return '';

  text = text.replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, '');
  text = text.split(/[/?#]/)[0];
  text = text.replace(/^@+/, '').trim();

  if (!/^[A-Za-z0-9_]{1,15}$/.test(text)) {
    throw new Error('X IDは英数字と「_」のみ、15文字以内で入力してください。');
  }
  return text;
}

async function openFeatureSettings() {
  closeMenu();
  $('featureSettingsStatus').textContent = '';

  const lightInput = $('settingLightMode');
  lightInput.disabled = false;
  lightInput.checked = applyLightMode();

  const lightNote = $('settingLightModeNote');
  if (lightNote) {
    lightNote.textContent = '画面をライトテーマに切り替えます。';
  }

  const columnsInput = $('settingSkillTargetColumns');
  const textSizeInput = $('settingTextSizeUp');
  if (columnsInput) {
    columnsInput.disabled = false;
    columnsInput.checked =
      localStorage.getItem(DISPLAY_CUSTOMIZATION_KEYS.skillTargetColumns) === '1';
  }
  if (textSizeInput) {
    textSizeInput.disabled = false;
    textSizeInput.checked =
      localStorage.getItem(DISPLAY_CUSTOMIZATION_KEYS.textSizeUp) === '1';
  }

  const gfDefaultOptionInput = $('settingGfDefaultOption');
  if (gfDefaultOptionInput) {
    gfDefaultOptionInput.value = getGfDefaultOption();
  }

  try {
    const settings = await getMyFeatureSettings();
    $('settingRecordsPublic').checked = Boolean(settings.registration_public);
    $('settingXPublic').checked = Boolean(settings.x_public);
    $('featureSettingsMask').style.display = 'flex';
  } catch (e) {
    await showSiteDialog('機能設定の取得に失敗しました: ' + e.message, 'エラー');
  }
}

function closeFeatureSettings(returnToMenu = false) {
  $('featureSettingsMask').style.display = 'none';
  if (returnToMenu) openMenu();
}

async function saveFeatureSettings() {
  const button = $('btnSaveFeatureSettings');
  const original = button.textContent;
  try {
    button.disabled = true;
    button.textContent = '保存中';
    $('featureSettingsStatus').textContent = '';

    const light = $('settingLightMode').checked;
    const skillTargetColumns = Boolean($('settingSkillTargetColumns')?.checked);
    const textSizeUp = Boolean($('settingTextSizeUp')?.checked);
    const displaySettings = writeLocalDisplaySettings({
      lightMode: light,
      skillTargetColumns,
      textSizeUp,
      gfDefaultOption: $('settingGfDefaultOption')?.value || 'NORMAL'
    });
    await saveMyDisplaySettingsToSupabase(displaySettings);
    if (skillTargetColumns && $('recordTypeFilter')) $('recordTypeFilter').value = '';
    render();

    const { error } = await supabase.rpc('set_my_feature_settings', {
      p_registration_public: $('settingRecordsPublic').checked,
      p_x_public: $('settingXPublic').checked
    });
    if (error) throw error;

    closeFeatureSettings();
    await showSiteDialog('機能設定を保存しました。', '保存完了');
  } catch (e) {
    $('featureSettingsStatus').textContent = '保存に失敗しました。';
    await showSiteDialog(e?.message || '機能設定の保存に失敗しました。', 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function saveMyXId() {
  const button = $('btnSaveXId');
  const original = button.textContent;

  try {
    const xId = normalizeXIdInput($('mypageXIdInput').value);
    button.disabled = true;
    button.textContent = '保存中';

    const { error } = await supabase.rpc('set_my_x_id', {
      p_x_id: xId || null
    });
    if (error) throw error;

    $('mypageXIdInput').value = xId;
    await showSiteDialog(
      xId ? 'X IDを保存しました。' : 'X IDを削除しました。',
      '保存完了'
    );
  } catch (e) {
    await showSiteDialog(e?.message || 'X IDの保存に失敗しました。', 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function showAuth(mode = 'login') {
  hide('introScreen');
  currentAuthMode = mode;
  hide('appScreen');
  show('authScreen');

  const isLogin = mode === 'login';
  $('authTitle').textContent = isLogin ? 'ログイン' : '新規登録';
  $('authSubmit').textContent = isLogin ? 'ログイン' : '登録する';
  $('authSwitch').textContent = isLogin ? '新規登録はこちら' : 'ログインはこちら';
  $('authSwitch').dataset.mode = isLogin ? 'register' : 'login';

  $('authPassword').required = true;
  $('authPassword').disabled = false;
  $('authPassword').value = '';
  $('authPassword').placeholder = isLogin ? 'パスワードを入力' : '8文字以上で設定';
  $('authPassword').autocomplete = isLogin ? 'current-password' : 'new-password';

  $('authPasswordConfirmGroup').classList.toggle('hidden', isLogin);
  $('authPasswordConfirm').required = !isLogin;
  $('authPasswordConfirm').value = '';
  $('authRegisterNotice').classList.toggle('hidden', isLogin);

  // 認証画面を開くたびにTurnstileを1回だけ準備する。
  // prepareAuthCaptcha() 側が、既に描画済みなら reset を1回だけ実行する。
  // reset→prepare の二重resetはトークン競合の原因になるため行わない。
  try {
    await prepareAuthCaptcha();
  } catch (error) {
    console.error('Turnstile初期化エラー:', error);
  }
}

async function showApp(session) {
  hide('introScreen');
  hide('authScreen');
  show('appScreen');
  applyAppScrollLayout(true);
  currentUserId = session?.user?.id || null;
  void recordMyActivity('OPEN');

  let username =
    session?.user?.user_metadata?.username ||
    session?.user?.email?.split('@')[0] || '';

  // ユーザー名変更後も常にprofiles側の最新値を表示
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.username) username = profile.username;
  } catch (e) {
    console.warn('プロフィール取得失敗:', e);
  }

  $('headerUsername').textContent = username;
  await syncMyDisplaySettings();
  await loadGameVersionOptions();
  await Promise.all([loadScores(), checkAdminAccess()]);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUserId) {
    void recordMyActivity('OPEN');
  }
});


let siteDialogResolver = null;
let siteDialogConfirmMode = false;
let siteDialogPromptMode = false;

function showSiteDialog(message, title = 'お知らせ') {
  siteDialogConfirmMode = false;
  siteDialogPromptMode = false;
  $('siteDialogInput').classList.add('hidden');
  $('siteDialogInput').value = '';
  $('siteDialogTitle').textContent = title;
  $('siteDialogMessage').textContent = String(message || '');
  $('siteDialogOk').textContent = 'OK';
  $('siteDialogCancel').classList.add('hidden');
  $('siteDialogMask').style.display = 'flex';

  return new Promise(resolve => {
    siteDialogResolver = resolve;
  });
}

function showSiteConfirm(message, title = '確認', confirmText = '削除する') {
  siteDialogConfirmMode = true;
  siteDialogPromptMode = false;
  $('siteDialogInput').classList.add('hidden');
  $('siteDialogInput').value = '';
  $('siteDialogTitle').textContent = title;
  $('siteDialogMessage').textContent = String(message || '');
  $('siteDialogOk').textContent = confirmText;
  $('siteDialogCancel').classList.remove('hidden');
  $('siteDialogMask').style.display = 'flex';

  return new Promise(resolve => {
    siteDialogResolver = resolve;
  });
}

function showSitePrompt(message, title = '入力', confirmText = 'OK', placeholder = '') {
  siteDialogConfirmMode = true;
  siteDialogPromptMode = true;
  $('siteDialogTitle').textContent = title;
  $('siteDialogMessage').textContent = String(message || '');
  $('siteDialogInput').classList.remove('hidden');
  $('siteDialogInput').value = '';
  $('siteDialogInput').placeholder = placeholder;
  $('siteDialogOk').textContent = confirmText;
  $('siteDialogCancel').classList.remove('hidden');
  $('siteDialogMask').style.display = 'flex';

  setTimeout(() => $('siteDialogInput').focus(), 0);

  return new Promise(resolve => {
    siteDialogResolver = resolve;
  });
}

function closeSiteDialog(result = true) {
  const promptValue = siteDialogPromptMode ? $('siteDialogInput').value : result;
  $('siteDialogMask').style.display = 'none';
  $('siteDialogCancel').classList.add('hidden');
  $('siteDialogInput').classList.add('hidden');
  $('siteDialogInput').value = '';
  const resolve = siteDialogResolver;
  siteDialogResolver = null;
  const wasPrompt = siteDialogPromptMode;
  siteDialogConfirmMode = false;
  siteDialogPromptMode = false;
  if (resolve) resolve(wasPrompt ? (result ? promptValue : null) : result);
}


async function loadGameVersionOptions() {
  gameVersions = await getGameVersions();

  if (!gameVersions.length) {
    throw new Error('GITADORAバージョン情報がありません。');
  }

  const stored = gameVersions.find(v => v.id === activeVersionId);
  activeVersion = stored || gameVersions.find(v => v.is_current) || gameVersions[0];
  activeVersionId = activeVersion.id;
  localStorage.setItem('gitadora_version_id', activeVersionId);

  $('versionSelect').innerHTML = gameVersions
    .map(v => `<option value="${v.id}">${esc(v.name)}</option>`)
    .join('');
  $('versionSelect').value = activeVersionId;
  updateActiveVersionLabel();
}

function updateActiveVersionLabel() {
  const label = $('headerActiveVersion');
  if (!label) return;
  const name = activeVersion?.name || activeVersion?.code || '';
  label.textContent = name ? `Ver. ${name}` : '';
  label.title = name;
}

async function switchGameVersion(versionId) {
  const next = gameVersions.find(v => v.id === versionId);
  if (!next || next.id === activeVersionId) return;

  activeVersion = next;
  activeVersionId = next.id;
  localStorage.setItem('gitadora_version_id', activeVersionId);
  updateActiveVersionLabel();

  selectedSong = null;
  editingScoreId = null;
  viewedUserScores = [];
  publicUsers = [];
  userListPage = 0;

  closeModal();
  closeRateComparison();
  closeUserDetail();

  await loadScores();
  if (activeTabName === 'USERS') await loadUsers({ resetPage: true });
  if (adminEnabled && adminTab === 'songs' && $('adminModal').style.display !== 'none') {
    adminSongPage = 0;
    await loadAdminSongs();
  }
}

function instrumentParts() { return partsForInstrument(activeInstrument); }
function instrumentPartOptionsHtml() {
  const optionHtml = part => `<option value="${part}">${part}</option>`;
  const parts = instrumentParts();
  if (activeInstrument === 'DM') return parts.map(optionHtml).join('');

  return `
    <optgroup label="-GUITAR-">
      ${parts.filter(part => part.endsWith('-G')).map(optionHtml).join('')}
    </optgroup>
    <optgroup label="-BASS-">
      ${parts.filter(part => part.endsWith('-B')).map(optionHtml).join('')}
    </optgroup>`;
}
function isCurrentInstrumentPart(part) { return instrumentParts().includes(String(part || '')); }
function updateDmBassMirrorFieldVisibility() {
  const enabled = activeInstrument === 'DM';
  $('dmOptionFieldGroup')?.classList.toggle('hidden', !enabled);
  document.body.classList.toggle('dm-bass-mirror-enabled', enabled);
  if (!enabled && $('formDmOption')) $('formDmOption').value = 'NORMAL';
}
function applyInstrumentUI() {
  document.querySelectorAll('[data-instrument]').forEach(b => b.classList.toggle('active', b.dataset.instrument === activeInstrument));
  $('partSelect').innerHTML = instrumentPartOptionsHtml();
  if ($('instrumentLabel')) $('instrumentLabel').textContent = activeInstrument;
  syncUserListSortControls();

  document.body.classList.toggle('dm-mode', activeInstrument === 'DM');
  if (activeInstrument === 'DM' && $('formOption')) {
    $('formOption').value = 'NORMAL';
  }
  updateDmBassMirrorFieldVisibility();
}
async function switchInstrument(instrument) {
  if (!['GF','DM'].includes(instrument) || instrument === activeInstrument) return;
  activeInstrument = instrument;
  localStorage.setItem('gitadora_instrument', instrument);
  userListSort = { key: instrument === 'DM' ? 'dm' : 'gf', dir: 'desc' };
  userListPage = 0;
  selectedSong = null; editingScoreId = null; viewedUserScores = []; publicUsers = [];
  applyInstrumentUI();
  closeModal();
  render();
  if (activeTabName === 'USERS') await loadUsers({ resetPage: true });

  if (viewedUserId && $('userDetailPage').style.display !== 'none') {
    await openUserDetail(viewedUserId, viewedUserName);
  }
}

async function init() {
  captureSkillSyncHash();
  applyInstrumentUI();
  await initAuthCaptcha();
  const session = await getSession();
  if (session) {
    await showApp(session);
    await processPendingSkillSync();
  } else {
    applyLightMode(false);
    hide('authScreen');
    hide('appScreen');
    show('introScreen');
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    // 初期表示は上の getSession() で処理済み。
    // TOKEN_REFRESHED / USER_UPDATED では画面全体を再読込しない。
    if (event === 'SIGNED_IN' && session) {
      await showApp(session);
      await processPendingSkillSync();
      return;
    }

    if (event === 'TOKEN_REFRESHED' && session && adminEnabled) {
      rememberAdminAccountSession(
        session,
        $('headerUsername')?.textContent || ''
      );
      return;
    }

    if (event === 'SIGNED_OUT' || !session) {
      adminEnabled = false;
      adminAccessChecked = false;
      applyAppScrollLayout(false);
      updateDmBassMirrorFieldVisibility();
      applyDisplayCustomization(false, false);
      applyLightMode(false);
      $('btnAdmin').classList.add('hidden');
      $('mypageUserSwitchBlock')?.classList.add('hidden');
      closeSkillTargetRanking();
      closeSkillHistory();
      $('menuOfuseSupport')?.classList.add('hidden');
      closeAdmin();
      closeAccountSwitch();
      hide('authScreen');
      hide('appScreen');
      show('introScreen');
    }
  });
}


let myPageOpenedFromMenu = false;
let skillShareSelection = 'GF';
const SKILL_HISTORY_PAGE_SIZE = 50;
let skillHistoryRows = [];
let skillHistoryOffset = 0;
let skillHistoryInstrument = 'GF';
let skillUnifiedSelection = 'GF';
let skillHistoryPreviewFile = null;
let skillHistoryPreviewUrl = '';
let skillHistoryPreviewSnapshot = null;
const ADMIN_ACCOUNT_SWITCH_STORAGE_KEY = 'gitadora_admin_account_sessions_v1';

function readStoredAdminAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_ACCOUNT_SWITCH_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(account =>
      account &&
      account.userId &&
      account.username &&
      account.accessToken &&
      account.refreshToken
    );
  } catch (_) {
    return [];
  }
}

function writeStoredAdminAccounts(accounts) {
  const unique = new Map();
  for (const account of accounts ?? []) {
    if (!account?.userId) continue;
    unique.set(account.userId, account);
  }
  localStorage.setItem(
    ADMIN_ACCOUNT_SWITCH_STORAGE_KEY,
    JSON.stringify([...unique.values()].slice(-8))
  );
}

function rememberAdminAccountSession(session, username = '') {
  if (!session?.user?.id || !session?.access_token || !session?.refresh_token) return;
  const accounts = readStoredAdminAccounts().filter(
    account => account.userId !== session.user.id
  );
  accounts.push({
    userId: session.user.id,
    username: String(username || session.user.user_metadata?.username || '').trim() || 'ユーザー',
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    updatedAt: Date.now()
  });
  writeStoredAdminAccounts(accounts);
}

function moveAccountSwitchCaptcha(toModal) {
  const wrap = $('authCaptchaWrap');
  const destination = toModal ? $('accountSwitchCaptchaHost') : $('authCaptchaHome');
  if (wrap && destination && wrap.parentElement !== destination) {
    destination.appendChild(wrap);
  }
}

function renderAccountSwitchList() {
  const target = $('accountSwitchList');
  if (!target) return;
  const accounts = readStoredAdminAccounts();
  target.innerHTML = accounts.length
    ? accounts.map(account => {
        const isCurrent = account.userId === currentUserId;
        return `
          <div class="account-switch-row${isCurrent ? ' current' : ''}">
            <div>
              <strong>${esc(account.username)}</strong>
              <small>${isCurrent ? '現在のアカウント' : '切り替え可能'}</small>
            </div>
            <div class="account-switch-actions">
              ${isCurrent ? '' : `<button type="button" class="btn-danger-wide account-switch-remove" data-remove-admin-account="${esc(account.userId)}">削除</button>`}
              <button type="button" class="app-primary-button" data-switch-admin-account="${esc(account.userId)}" ${isCurrent ? 'disabled' : ''}>
                ${isCurrent ? '使用中' : '切り替え'}
              </button>
            </div>
          </div>`;
      }).join('')
    : '<div class="account-switch-empty">保存済みのユーザーはありません。</div>';
}

async function openAccountSwitch() {
  $('mypageModal').style.display = 'none';
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    rememberAdminAccountSession(data.session, $('headerUsername')?.textContent || '');
  }
  renderAccountSwitchList();
  $('accountSwitchUsername').value = '';
  $('accountSwitchPassword').value = '';
  $('accountSwitchStatus').textContent = '';
  $('accountSwitchMask').style.display = 'flex';
  moveAccountSwitchCaptcha(true);
  try {
    await prepareAuthCaptcha();
  } catch (error) {
    $('accountSwitchStatus').textContent = error?.message || 'セキュリティ確認を準備できませんでした。';
  }
}

function closeAccountSwitch(returnToMyPage = false) {
  $('accountSwitchMask').style.display = 'none';
  $('accountSwitchPassword').value = '';
  moveAccountSwitchCaptcha(false);
  if (returnToMyPage) $('mypageModal').style.display = 'flex';
}

async function activateStoredAdminAccount(userId) {
  const account = readStoredAdminAccounts().find(item => item.userId === userId);
  if (!account) throw new Error('保存済みのユーザー情報が見つかりません。');

  const { data, error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken
  });
  if (error || !data?.session) {
    writeStoredAdminAccounts(
      readStoredAdminAccounts().filter(item => item.userId !== userId)
    );
    throw error || new Error('セッションの有効期限が切れています。再度追加してください。');
  }

  rememberAdminAccountSession(data.session, account.username);
  location.reload();
}

async function addAdminSwitchAccount() {
  const username = $('accountSwitchUsername').value.trim();
  const password = $('accountSwitchPassword').value;
  const button = $('btnAddSwitchAccount');
  const original = button.textContent;

  try {
    if (!username || !password) throw new Error('ユーザー名とパスワードを入力してください。');
    button.disabled = true;
    button.textContent = '確認中...';
    $('accountSwitchStatus').textContent = '';

    const result = await loginForAccountSwitch(
      username,
      password,
      getAuthCaptchaToken,
      resetAuthCaptcha
    );

    const candidate = {
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token
    };
    rememberAdminAccountSession(candidate, result.username);

    const { data, error } = await supabase.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token
    });
    if (error || !data?.session) throw error || new Error('ユーザーを切り替えられませんでした。');

    rememberAdminAccountSession(data.session, result.username);
    location.reload();
  } catch (error) {
    $('accountSwitchStatus').textContent = error?.message || 'ユーザーを追加できませんでした。';
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function openMenu() {
  $('menuOfuseSupport')?.classList.remove('hidden');
  $('menuMask').style.display = 'flex';
}

function updateSkillShareSelection(selection) {
  skillShareSelection = ['GF', 'DM', 'BOTH'].includes(selection) ? selection : activeInstrument;
  document.querySelectorAll('[data-skill-share-selection]').forEach(button => {
    const selected = button.dataset.skillShareSelection === skillShareSelection;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function openSkillShareDialog() {
  closeMenu();
  updateSkillShareSelection(activeInstrument);
  $('skillShareMask').style.display = 'flex';
}

function closeSkillShareDialog(returnToMenu = false) {
  $('skillShareMask').style.display = 'none';
  if (returnToMenu) openMenu();
}

async function executeSkillShare() {
  const button = $('btnExecuteSkillShare');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = skillShareSelection === 'BOTH' ? '2枚を生成中...' : '画像を生成中...';

  try {
    await shareSkillImage(skillShareSelection);
    closeSkillShareDialog();
  } catch (error) {
    await showSiteDialog('共有に失敗しました: ' + error.message, 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function formatSkillHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function serializeSkillHistoryRow(row) {
  return {
    title: String(row?.title || ''),
    part: String(row?.part || ''),
    level: Number(row?.level) || 0,
    achievement_rate: Number(row?.achievement_rate) || 0,
    skill: Number(row?.skill) || 0,
    fc: row?.fc ? String(row.fc) : null,
    play_option: String(row?.play_option || 'NORMAL'),
    is_hot: Boolean(row?.is_hot)
  };
}

function releaseSkillHistoryPreview() {
  if (skillHistoryPreviewUrl) URL.revokeObjectURL(skillHistoryPreviewUrl);
  skillHistoryPreviewUrl = '';
  skillHistoryPreviewFile = null;
  skillHistoryPreviewSnapshot = null;
  const image = $('skillHistoryPreviewImage');
  if (image) image.removeAttribute('src');
}

function showSkillHistoryListView() {
  releaseSkillHistoryPreview();
  $('skillHistoryPreviewView').classList.add('hidden');
  $('skillHistoryListView').classList.remove('hidden');
  $('skillHistoryTitle').textContent = '現在のスキル対象を共有・保存';
  $('skillHistoryContext').textContent = '';
  $('btnCloseSkillHistory').textContent = '戻る';
}

function renderSkillHistoryList() {
  const list = $('skillHistoryList');
  if (!skillHistoryRows.length) {
    list.innerHTML = '<div class="skill-history-empty">保存した履歴はありません。</div>';
    return;
  }

  list.innerHTML = skillHistoryRows.map(row => `
    <div class="skill-history-row has-compare">
      <div class="skill-history-summary">
        <span class="skill-history-date">${esc(formatSkillHistoryDate(row.saved_at))}</span>
        <strong class="skill-history-value score-rank-${getTotalSkillRank(row.total_skill)}">${Number(row.total_skill).toFixed(2)}</strong>
      </div>
      <button type="button" class="skill-history-display" data-open-skill-history="${esc(row.snapshot_id)}">表示</button>
      <button type="button" class="skill-history-compare" data-compare-skill-history="${esc(row.snapshot_id)}">比較</button>
      <button type="button" class="skill-history-delete" data-delete-skill-history="${esc(row.snapshot_id)}">削除</button>
    </div>
  `).join('');
}

async function loadSkillHistory(reset = false) {
  if (reset) {
    skillHistoryRows = [];
    skillHistoryOffset = 0;
    renderSkillHistoryList();
  }

  const moreButton = $('btnLoadMoreSkillHistory');
  const status = $('skillHistoryStatus');
  moreButton.disabled = true;
  status.textContent = '履歴を読み込んでいます...';

  try {
    const { data, error } = await supabase.rpc('list_my_skill_target_snapshots', {
      p_instrument: skillHistoryInstrument,
      p_limit: SKILL_HISTORY_PAGE_SIZE,
      p_offset: skillHistoryOffset
    });
    if (error) throw error;

    const rows = (data || []).map(row => ({
      ...row,
      instrument: String(row.instrument || ''),
      total_skill: Number(row.total_skill) || 0
    }));
    skillHistoryRows.push(...rows);
    skillHistoryOffset += rows.length;
    renderSkillHistoryList();
    moreButton.classList.toggle('hidden', rows.length < SKILL_HISTORY_PAGE_SIZE);
    status.textContent = `${skillHistoryInstrument}の履歴 ${skillHistoryRows.length}件`;
  } catch (error) {
    console.error('skill history load failed:', error);
    moreButton.classList.add('hidden');
    status.textContent = /list_my_skill_target_snapshots|schema cache|PGRST202/i.test(String(error?.message || ''))
      ? 'Supabaseで v37_skill_target_history_admin_preview.sql を実行してください。'
      : `履歴を取得できませんでした：${error?.message || '不明なエラー'}`;
  } finally {
    moreButton.disabled = false;
  }
}

async function openSkillHistory() {
  closeMenu();
  showSkillHistoryListView();
  updateSkillHistoryInstrument(activeInstrument, false);
  $('skillHistoryLegacyControls')?.classList.add('hidden');
  $('skillHistoryUnifiedControls')?.classList.remove('hidden');
  updateUnifiedSkillSelection(activeInstrument, false);
  $('skillHistoryStatus').textContent = '';
  $('skillHistoryMask').style.display = 'flex';
  await loadSkillHistory(true);
}

function closeSkillHistory(returnToMenu = false) {
  releaseSkillHistoryPreview();
  $('skillHistoryMask').style.display = 'none';
  $('skillHistoryPreviewView').classList.add('hidden');
  $('skillHistoryListView').classList.remove('hidden');
  if (returnToMenu) openMenu();
}

function updateSkillHistoryInstrument(instrument, reload = true) {
  skillHistoryInstrument = instrument === 'DM' ? 'DM' : 'GF';
  document.querySelectorAll('[data-skill-history-instrument]').forEach(button => {
    const active = button.dataset.skillHistoryInstrument === skillHistoryInstrument;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if ($('skillHistoryListTitle')) {
    $('skillHistoryListTitle').textContent = `保存履歴（${skillHistoryInstrument}）`;
  }
  if (reload) loadSkillHistory(true).catch(console.error);
}

function updateUnifiedSkillSelection(selection, reload = true) {
  skillUnifiedSelection = ['GF', 'DM', 'BOTH'].includes(selection) ? selection : activeInstrument;
  document.querySelectorAll('[data-skill-unified-selection]').forEach(button => {
    const active = button.dataset.skillUnifiedSelection === skillUnifiedSelection;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  // 「両方」は共有・保存対象だけを変え、現在表示中の履歴タブは維持する。
  if (skillUnifiedSelection !== 'BOTH') {
    updateSkillHistoryInstrument(skillUnifiedSelection, reload);
  }
}

async function saveSkillHistoryForInstrument(instrument) {
  const target = totals(instrument);
  if (target.hotRows.length + target.otherRows.length === 0) {
    throw new Error(`${instrument}に保存できるスキル対象がありません。`);
  }
  const snapshotData = {
    schema_version: 1,
    username: String($('headerUsername')?.textContent || '').trim(),
    version_name: String(activeVersion?.name || ''),
    hot_rows: target.hotRows.map(serializeSkillHistoryRow),
    other_rows: target.otherRows.map(serializeSkillHistoryRow)
  };
  const { error } = await supabase.rpc('save_my_skill_target_snapshot', {
    p_instrument: instrument,
    p_version_id: activeVersionId,
    p_version_name: activeVersion?.name || '',
    p_total_skill: Number(target.total) || 0,
    p_hot_skill: Number(target.hot) || 0,
    p_other_skill: Number(target.other) || 0,
    p_snapshot_data: snapshotData
  });
  if (error) throw error;
}

async function saveCurrentSkillHistory() {
  const button = $('btnSaveSkillHistory');
  const originalText = button.textContent;
  const instrument = skillHistoryInstrument;
  const target = totals(instrument);
  if (target.hotRows.length + target.otherRows.length === 0) {
    await showSiteDialog(`${instrument}に保存できるスキル対象がありません。`, 'スキル対象履歴');
    return;
  }

  button.disabled = true;
  button.textContent = '保存中...';
  try {
    await saveSkillHistoryForInstrument(instrument);
    await loadSkillHistory(true);
    $('skillHistoryStatus').textContent = `${instrument}の現在のスキル対象を保存しました。`;
  } catch (error) {
    console.error('skill history save failed:', error);
    await showSiteDialog(`履歴を保存できませんでした：${error?.message || '不明なエラー'}`, 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function executeUnifiedSkillAction(action) {
  const buttons = [
    $('btnUnifiedSkillShare'),
    $('btnUnifiedSkillSave'),
    $('btnUnifiedSkillSaveShare')
  ].filter(Boolean);
  const source = action === 'share'
    ? $('btnUnifiedSkillShare')
    : action === 'save'
      ? $('btnUnifiedSkillSave')
      : $('btnUnifiedSkillSaveShare');
  const original = source.textContent;
  const instruments = skillUnifiedSelection === 'BOTH' ? ['GF', 'DM'] : [skillUnifiedSelection];
  buttons.forEach(button => { button.disabled = true; });
  source.textContent = action === 'share' ? '生成中...' : '保存中...';
  try {
    if (action !== 'share') {
      for (const instrument of instruments) await saveSkillHistoryForInstrument(instrument);
      await loadSkillHistory(true);
      $('skillHistoryStatus').textContent = `${instruments.join('・')}の現在のスキル対象を保存しました。`;
    }
    if (action !== 'save') {
      source.textContent = '共有中...';
      await shareSkillImage(skillUnifiedSelection);
    }
  } catch (error) {
    console.error('unified skill share/save failed:', error);
    await showSiteDialog(`処理できませんでした：${error?.message || '不明なエラー'}`, 'エラー');
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    source.textContent = original;
  }
}

async function getSkillHistorySnapshot(snapshotId) {
  const { data, error } = await supabase.rpc('get_my_skill_target_snapshot', {
    p_snapshot_id: snapshotId
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('履歴が見つかりません。');
  const stored = typeof row.snapshot_data === 'string'
    ? JSON.parse(row.snapshot_data)
    : (row.snapshot_data || {});
  return {
    snapshotId: row.snapshot_id || snapshotId,
    versionId: row.version_id || null,
    instrument: row.instrument,
    versionName: row.version_name || stored.version_name || '',
    username: stored.username || '',
    savedAt: row.saved_at,
    total: Number(row.total_skill) || 0,
    hot: Number(row.hot_skill) || 0,
    other: Number(row.other_skill) || 0,
    hotRows: Array.isArray(stored.hot_rows) ? stored.hot_rows : [],
    otherRows: Array.isArray(stored.other_rows) ? stored.other_rows : []
  };
}

async function openSkillHistoryPreview(snapshotId) {
  const status = $('skillHistoryStatus');
  status.textContent = '共有画像を生成しています...';
  try {
    const snapshot = await getSkillHistorySnapshot(snapshotId);

    releaseSkillHistoryPreview();
    skillHistoryPreviewFile = await createSkillShareFile(snapshot.instrument, snapshot);
    skillHistoryPreviewUrl = URL.createObjectURL(skillHistoryPreviewFile);
    skillHistoryPreviewSnapshot = snapshot;
    $('skillHistoryPreviewImage').src = skillHistoryPreviewUrl;
    $('skillHistoryListView').classList.add('hidden');
    $('skillHistoryPreviewView').classList.remove('hidden');
    $('skillHistoryContext').textContent = `${snapshot.instrument} / ${formatSkillHistoryDate(snapshot.savedAt)} / ${Number(snapshot.total).toFixed(2)}`;
    status.textContent = '';
    document.querySelector('.skill-history-body')?.scrollTo({ top: 0, behavior: 'auto' });
  } catch (error) {
    console.error('skill history preview failed:', error);
    status.textContent = '';
    await showSiteDialog(`履歴画像を生成できませんでした：${error?.message || '不明なエラー'}`, 'エラー');
  }
}

async function openSkillHistoryComparison(snapshotId) {
  const status = $('skillHistoryStatus');
  status.textContent = '現在のスキル対象と比較しています...';
  try {
    const baseline = await getSkillHistorySnapshot(snapshotId);
    if (baseline.versionId && String(baseline.versionId) !== String(activeVersionId)) {
      throw new Error('現在参照中のバージョンと同じ履歴だけ比較できます。');
    }
    const current = totals(baseline.instrument);
    if (!current.hotRows.length && !current.otherRows.length) {
      throw new Error(`${baseline.instrument}に比較できる現在のスキル対象がありません。`);
    }
    releaseSkillHistoryPreview();
    skillHistoryPreviewFile = await createSkillShareFile(baseline.instrument, null, baseline);
    skillHistoryPreviewUrl = URL.createObjectURL(skillHistoryPreviewFile);
    skillHistoryPreviewSnapshot = {
      instrument: baseline.instrument,
      total: Number(current.total) || 0
    };
    $('skillHistoryPreviewImage').src = skillHistoryPreviewUrl;
    $('skillHistoryListView').classList.add('hidden');
    $('skillHistoryPreviewView').classList.remove('hidden');
    $('skillHistoryContext').textContent = `${baseline.instrument} / 現在と ${formatSkillHistoryDate(baseline.savedAt)} を比較`;
    status.textContent = '';
    document.querySelector('.skill-history-body')?.scrollTo({ top: 0, behavior: 'auto' });
  } catch (error) {
    console.error('skill history comparison failed:', error);
    status.textContent = '';
    await showSiteDialog(`比較画像を生成できませんでした：${error?.message || '不明なエラー'}`, 'エラー');
  }
}

async function shareSkillHistoryPreview() {
  if (!skillHistoryPreviewFile || !skillHistoryPreviewSnapshot) return;
  const button = $('btnShareSkillHistory');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '共有中...';
  try {
    const snapshot = skillHistoryPreviewSnapshot;
    await shareGeneratedSkillFiles(
      [skillHistoryPreviewFile],
      [`GITADORA ${snapshot.instrument} SKILL ${Number(snapshot.total).toFixed(2)}`]
    );
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function deleteSkillHistory(snapshotId) {
  const row = skillHistoryRows.find(item => item.snapshot_id === snapshotId);
  const confirmed = await showSiteConfirm(
    `${formatSkillHistoryDate(row?.saved_at)}に保存したスキル対象履歴を削除しますか？`,
    '履歴の削除',
    '削除する'
  );
  if (!confirmed) return;

  try {
    const { error } = await supabase.rpc('delete_my_skill_target_snapshot', {
      p_snapshot_id: snapshotId
    });
    if (error) throw error;
    await loadSkillHistory(true);
    $('skillHistoryStatus').textContent = '履歴を削除しました。';
  } catch (error) {
    await showSiteDialog(`履歴を削除できませんでした：${error?.message || '不明なエラー'}`, 'エラー');
  }
}

function openRivalManage() {
  closeMenu();
  $('rivalManageMask').style.display = 'flex';
  loadFavorites().catch(console.error);
}
function closeRivalManage(returnToMenu = false) {
  $('rivalManageMask').style.display = 'none';
  if (returnToMenu) openMenu();
}

async function openFavoriteUserDetail(userId, username, instrument) {
  closeRivalManage();

  if (instrument !== activeInstrument) {
    await switchInstrument(instrument);
  }

  await openUserDetail(userId, username);
}

function closeMenu() { $('menuMask').style.display = 'none'; }

async function loadMyFeedbackHistory() {
  const target = $('feedbackHistory');
  if (!target) return;

  target.innerHTML = '<div class="feedback-history-empty">読み込み中...</div>';

  try {
    const { data, error } = await supabase.rpc('get_my_feedback_history');
    if (error) throw error;

    const rows = data ?? [];
    target.innerHTML = rows.map(item => {
      const categoryLabel = item.category === 'bug' ? '不具合' : '要望';
      const isDone = item.status === 'resolved';
      const reply = String(item.admin_reply || '').trim();

      return `
        <div class="feedback-history-card">
          <div class="feedback-history-top">
            <span class="feedback-category ${item.category === 'bug' ? 'bug' : 'request'}">${categoryLabel}</span>
            <span class="feedback-history-date">${new Date(item.created_at).toLocaleString('ja-JP')}</span>
          </div>
          <div class="feedback-history-message">${esc(item.message).replace(/\\n/g, '<br>')}</div>
          ${(item.device_name || item.browser_name) ? `
            <div class="feedback-history-env">
              <strong>ご利用環境</strong><br>
              機種名：${esc(item.device_name || '未入力')}<br>
              ブラウザ：${esc(item.browser_name || '未入力')}
            </div>
          ` : ''}
          ${reply ? `
            <div class="feedback-history-reply">
              <div class="feedback-history-reply-label">管理者からの返信</div>
              <div class="feedback-history-reply-message">${esc(reply).replace(/\\n/g, '<br>')}</div>
            </div>
          ` : ''}
          <div class="feedback-history-status">${reply ? '返信済み' : (isDone ? '対応済み' : '未対応')}</div>
        </div>`;
    }).join('') || '<div class="feedback-history-empty">送信履歴はありません</div>';
  } catch (e) {
    console.error('要望・不具合履歴取得エラー:', e);
    target.innerHTML = '<div class="feedback-history-empty">送信履歴の取得に失敗しました</div>';
  }
}

function openFeedback() {
  closeMenu();
  $('feedbackCategory').value = 'request';
  $('feedbackDevice').value = '';
  $('feedbackBrowser').value = '';
  $('feedbackMessage').value = '';
  $('feedbackStatus').textContent = '';
  $('feedbackMask').style.display = 'flex';
  loadMyFeedbackHistory();
}
function closeFeedback(returnToMenu = false) {
  $('feedbackMask').style.display = 'none';
  if (returnToMenu) openMenu();
}

async function submitFeedback() {
  const category = $('feedbackCategory').value;
  const deviceName = $('feedbackDevice').value.trim();
  const browserName = $('feedbackBrowser').value.trim();
  const message = $('feedbackMessage').value.trim();
  if (!message) {
    await showSiteDialog('内容を入力してください。', '入力エラー');
    return;
  }
  if (message.length > 2000) {
    await showSiteDialog('内容は2000文字以内で入力してください。', '入力エラー');
    return;
  }

  const button = $('btnSubmitFeedback');
  const original = button.textContent;
  try {
    button.disabled = true;
    button.textContent = '送信中';
    $('feedbackStatus').textContent = '';

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('ログイン情報を取得できません。');

    const { error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userData.user.id,
        category,
        message,
        device_name: deviceName || null,
        browser_name: browserName || null
      });

    if (error) throw error;

    $('feedbackDevice').value = '';
    $('feedbackBrowser').value = '';
    $('feedbackMessage').value = '';
    await loadMyFeedbackHistory();
    await showSiteDialog('送信しました。送信履歴に追加しました。', '送信完了');
  } catch (e) {
    console.error('要望・不具合報告送信エラー:', e);
    $('feedbackStatus').textContent = '送信に失敗しました。';
    await showSiteDialog(e?.message || '送信に失敗しました。', 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function openHowTo() { closeMenu(); $('howToMask').style.display = 'flex'; }
function closeHowTo(returnToMenu = false) { $('howToMask').style.display = 'none'; if (returnToMenu) openMenu(); }

const skillRankingState = {
  rows: [],
  category: 'HOT',
  sort: 'percentage',
  loading: false
};

function buildSkillRankingRangeOptions() {
  const minSelect = $('skillRankingMin');
  const maxSelect = $('skillRankingMax');
  if (!minSelect || !maxSelect || minSelect.options.length || maxSelect.options.length) return;

  minSelect.innerHTML = Array.from({ length: 100 }, (_, index) => {
    const value = index * 100;
    return `<option value="${value}">${value}</option>`;
  }).join('');
  maxSelect.innerHTML = Array.from({ length: 100 }, (_, index) => {
    const value = (index + 1) * 100;
    return `<option value="${value}">${value}</option>`;
  }).join('');
}

function setDefaultSkillRankingRange() {
  buildSkillRankingRangeOptions();
  const ownTotal = Math.max(0, Math.min(10000, Number(totals().total) || 0));
  const lower = Math.min(9900, Math.floor(ownTotal / 100) * 100);
  $('skillRankingMin').value = String(lower);
  $('skillRankingMax').value = String(lower + 100);
}

function keepSkillRankingRangeValid(changedSide) {
  let lower = Number($('skillRankingMin').value);
  let upper = Number($('skillRankingMax').value);

  if (upper - lower < 100) {
    if (changedSide === 'min') {
      upper = Math.min(10000, lower + 100);
      if (upper - lower < 100) lower = upper - 100;
    } else {
      lower = Math.max(0, upper - 100);
      if (upper - lower < 100) upper = lower + 100;
    }
  }

  $('skillRankingMin').value = String(lower);
  $('skillRankingMax').value = String(upper);
}

function skillRankingTitleCompare(a, b) {
  return String(a.title || '').localeCompare(String(b.title || ''), 'ja', {
    numeric: true,
    sensitivity: 'base'
  }) || String(a.part || '').localeCompare(String(b.part || ''), 'ja');
}

function sortSkillRankingRows(rows) {
  const sorted = [...rows];
  const percentageTie = (a, b) =>
    Number(b.inclusion_percentage) - Number(a.inclusion_percentage)
    || Number(b.average_skill) - Number(a.average_skill)
    || skillRankingTitleCompare(a, b);

  if (skillRankingState.sort === 'title') {
    return sorted.sort((a, b) => skillRankingTitleCompare(a, b));
  }
  if (skillRankingState.sort === 'average') {
    return sorted.sort((a, b) =>
      Number(b.average_skill) - Number(a.average_skill)
      || percentageTie(a, b)
    );
  }
  if (skillRankingState.sort === 'comparison') {
    return sorted.sort((a, b) => {
      const aMissing = a.comparison == null;
      const bMissing = b.comparison == null;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing) {
        const difference = Number(b.comparison) - Number(a.comparison);
        if (difference) return difference;
      }
      return percentageTie(a, b);
    });
  }
  return sorted.sort(percentageTie);
}

function formatSkillRankingComparison(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return { text: '比較なし', className: 'neutral' };
  }
  const number = Number(value);
  if (number > 0) return { text: `+${number.toFixed(2)}`, className: 'positive' };
  if (number < 0) return { text: number.toFixed(2), className: 'negative' };
  return { text: '±0.00', className: 'neutral' };
}

function scrollSkillRankingToTop() {
  const body = document.querySelector('.skill-ranking-body');
  if (!body) return;
  body.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function renderSkillTargetRanking() {
  const list = $('skillRankingList');
  if (!list) return;

  const rows = sortSkillRankingRows(
    skillRankingState.rows.filter(row => row.category === skillRankingState.category)
  );
  document.querySelectorAll('.skill-ranking-tab').forEach(button => {
    const category = button.dataset.rankingCategory;
    button.classList.toggle('active', category === skillRankingState.category);
    button.textContent = category;
  });

  if (skillRankingState.loading) {
    list.innerHTML = '<div class="skill-ranking-empty">集計中...</div>';
    return;
  }
  if (!rows.length) {
    list.innerHTML = '<div class="skill-ranking-empty">このスキル帯に表示できるデータがありません。</div>';
    return;
  }

  list.innerHTML = rows.map((row, index) => {
    const ownSkill = row.my_skill == null ? null : Number(row.my_skill);
    const comparison = formatSkillRankingComparison(row.comparison);
    return `
      <div class="skill-ranking-row">
        <div class="skill-ranking-row-top">
          <span class="skill-ranking-position">#${index + 1}</span>
          <span class="skill-ranking-song" title="${esc(row.title)}">${esc(row.title)}</span>
          <span class="p-badge ${getPartColorClass(row.part)}">${esc(row.part)}</span>
          <span class="skill-ranking-level">Lv${Number(row.level).toFixed(2)}</span>
        </div>
        <div class="skill-ranking-metrics">
          <div class="skill-ranking-metric">
            <small>対象入り割合</small>
            <strong>${Number(row.inclusion_percentage).toFixed(2)}%</strong>
            <em>${Number(row.target_user_count)} / ${Number(row.eligible_user_count)}人</em>
          </div>
          <div class="skill-ranking-metric">
            <small>スキル値平均</small>
            <strong>${Number(row.average_skill).toFixed(2)}</strong>
            <em>対象入りユーザー平均</em>
          </div>
          <div class="skill-ranking-metric">
            <small>平均との比較</small>
            <strong>${ownSkill == null ? '未登録' : ownSkill.toFixed(2)}</strong>
            <em class="skill-ranking-comparison ${comparison.className}">${comparison.text}</em>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function loadSkillTargetRanking() {
  if (skillRankingState.loading) return;
  keepSkillRankingRangeValid('min');
  scrollSkillRankingToTop();

  const lower = Number($('skillRankingMin').value);
  const upper = Number($('skillRankingMax').value);
  const button = $('btnLoadSkillRanking');
  const status = $('skillRankingStatus');

  skillRankingState.loading = true;
  skillRankingState.rows = [];
  button.disabled = true;
  button.textContent = '集計中...';
  status.className = 'skill-ranking-status';
  status.textContent = `${lower}～${upper} を集計しています。`;
  renderSkillTargetRanking();

  try {
    const { data, error } = await supabase.rpc('get_skill_target_rankings', {
      p_instrument: activeInstrument,
      p_version_id: activeVersionId,
      p_min_skill: lower,
      p_max_skill: upper
    });
    if (error) throw error;

    skillRankingState.rows = (data || []).map(row => ({
      ...row,
      level: Number(row.level),
      inclusion_percentage: Number(row.inclusion_percentage),
      target_user_count: Number(row.target_user_count),
      eligible_user_count: Number(row.eligible_user_count),
      average_skill: Number(row.average_skill),
      my_skill: row.my_skill == null ? null : Number(row.my_skill),
      comparison: row.comparison == null ? null : Number(row.comparison)
    }));

    const eligibleCount = skillRankingState.rows.length
      ? Number(skillRankingState.rows[0].eligible_user_count)
      : 0;
    status.textContent = `対象ユーザー ${eligibleCount}人`;
  } catch (error) {
    console.error('skill target ranking load failed:', error);
    const missingFunction = /get_skill_target_rankings|schema cache|PGRST202/i.test(String(error?.message || ''));
    status.className = 'skill-ranking-status error';
    status.textContent = missingFunction
      ? 'Supabaseで v28_theoretical_max_account.sql を実行してください。'
      : `集計に失敗しました：${error?.message || '不明なエラー'}`;
  } finally {
    skillRankingState.loading = false;
    button.disabled = false;
    button.textContent = '表示する';
    renderSkillTargetRanking();
  }
}

async function openSkillTargetRanking() {
  closeMenu();
  skillRankingState.category = 'HOT';
  skillRankingState.sort = 'percentage';
  $('skillRankingSort').value = 'percentage';
  $('skillRankingContext').textContent = `${activeVersion?.name || '現在のVERSION'} / ${activeInstrument}`;
  setDefaultSkillRankingRange();
  $('skillRankingMask').style.display = 'flex';
  scrollSkillRankingToTop();
  await loadSkillTargetRanking();
}

function closeSkillTargetRanking(returnToMenu = false) {
  $('skillRankingMask').style.display = 'none';
  if (returnToMenu) openMenu();
}

async function createSkillShareFile(instrument, snapshot = null, comparisonBaseline = null) {
  // Array.mapのコールバックとして渡された場合のindexなどを、
  // 履歴スナップショットとして誤認しない。
  const validSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot
    : null;
  const target = validSnapshot || totals(instrument);
  const rowsHot = target.hotRows || [];
  const rowsOther = target.otherRows || [];
  const isComparison = Boolean(comparisonBaseline);
  // 新しい共有画像レイアウトは、確認中のため管理者だけに適用する。
  const useUnifiedShareLayout = true;

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
  const songPaint = (value, left, top, width, height) =>
    skillColorCanvasPaint(x, getSkillColorRowByTotalValue((Number(value) || 0) * 50), left, top, width, height);

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
  x.fillText(validSnapshot?.versionName || activeVersion?.name || '', 54, 118);

  // ユーザー名 + TOTALスキルを横並び。
  // 旧ユーザー名(22px)と旧TOTAL(68px)の中間程度として42pxに統一。
  // 両方ともTOTALスキルカラーに準拠する。
  const shareUsername = String(validSnapshot?.username || $('headerUsername')?.textContent || '').trim();
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
      x.font=useUnifiedShareLayout ? '900 20px sans-serif' : '800 16px sans-serif';
      let titleText=String(r.title||'');
      while(x.measureText(titleText).width > widths[1]-16 && titleText.length>4) titleText=titleText.slice(0,-1);
      if(titleText!==String(r.title||'')) titleText=titleText.slice(0,-1)+'…';
      x.fillText(titleText,pos[1]+8,y+19);

      const partText = String(r.part || '');
      const partX = pos[1] + 8;
      const optionText = String(r.play_option || 'NORMAL').toUpperCase();
      const optionLabel = optionText === 'BASS_MIRROR' ? 'バスミラー' : optionText;
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

      if (useUnifiedShareLayout) {
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
      } else {
        // 一般ユーザーは従来レイアウトを維持する。
        x.textBaseline='alphabetic';
        x.fillStyle='#94a3b8'; x.font='700 12px sans-serif';
        const partY = y + 48;
        x.fillText(partText, partX, partY);

        if (showOption) {
          const st = optionStyles[optionText] || { text:'#cbd5e1', border:'#475569', bg:'rgba(30,41,59,.5)' };
          x.font = '900 9px sans-serif';
          const optionW = Math.max(34, Math.ceil(x.measureText(optionLabel).width) + 12);
          const optionH = 15;
          const optionX = partX + x.measureText(partText).width + 12;
          const optionY = y + 36;

          if (optionX + optionW <= pos[2] - 5) {
            x.fillStyle = st.bg;
            x.beginPath();
            x.roundRect(optionX, optionY, optionW, optionH, 3);
            x.fill();
            x.strokeStyle = st.border;
            x.lineWidth = 1;
            x.stroke();
            x.fillStyle = st.text;
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.fillText(optionLabel, optionX + optionW / 2, optionY + optionH / 2 + .5);
            x.textAlign = 'left';
            x.textBaseline = 'alphabetic';
          }
        }
      }

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
      x.font=useUnifiedShareLayout ? '900 20px sans-serif' : '900 19px sans-serif';
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

      // 管理者用新レイアウトでは達成率を上下中央へ置き、FC/EXCは曲名列へ移す。
      x.fillStyle='#f8fafc';
      x.font=useUnifiedShareLayout ? '800 18px sans-serif' : '900 16px sans-serif';
      x.fillText(
        `${Number(r.achievement_rate).toFixed(2)}%`,
        pos[3]+widths[3]/2,
        isComparison ? valueMainY : (useUnifiedShareLayout ? y+rowH/2 : y+18)
      );
      drawComparisonDelta(
        Number(r.achievement_rate) || 0,
        comparison?.row?.achievement_rate,
        pos[3] + widths[3] / 2
      );

      if(!useUnifiedShareLayout && badge){
        // 画面上のスキル対象 / 登録曲と同じFC・EXC配色。
        // 共有画像では少し小さめにする。
        const bw=40,bh=15,bx=pos[3]+(widths[3]-bw)/2,by=y+34;
        const bg=x.createLinearGradient(bx,by,bx,by+bh);
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
        x.roundRect(bx,by,bw,bh,3);
        x.fill();
        x.strokeStyle=badge==='EXC'?'#b45309':'#475569';
        x.lineWidth=1;
        x.stroke();
        x.fillStyle=badge==='EXC'?'#7f1d1d':'#1e3a8a';
        x.font='900 8px sans-serif';
        x.textAlign='center';
        x.textBaseline='middle';
        x.fillText(badge,pos[3]+widths[3]/2,by+bh/2+.5);
      }

      // level
      x.fillStyle='#e5e7eb';
      x.font=useUnifiedShareLayout ? '800 18px sans-serif' : '800 17px sans-serif';
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

function downloadSkillShareFiles(files) {
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    setTimeout(() => {
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, index * 180);
  });
}

async function shareSkillImage(selection = activeInstrument) {
  const instruments = selection === 'BOTH' ? ['GF', 'DM'] : [selection];
  // mapが渡す(index, array)をsnapshot引数へ混入させない。
  const files = await Promise.all(
    instruments.map(instrument => createSkillShareFile(instrument))
  );
  const skillLines = instruments
    .map(instrument => `GITADORA ${instrument} SKILL ${Number(totals(instrument).total).toFixed(2)}`);
  await shareGeneratedSkillFiles(files, skillLines);
}

async function shareGeneratedSkillFiles(files, skillLines) {
  // Xの共有画面で末尾のハッシュタグと認識候補が重なって見えないため、
  // ハッシュタグの後に改行を入れてカーソル位置を次の行へ送る。
  const text = `${skillLines.join('\n')}\n#GITADORASkillSimulator\n`;

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
      await navigator.share({ files, title: 'GITADORA Skill Simulator', text });
    } else {
      downloadSkillShareFiles(files);
      const message = files.length === 2
        ? 'GF・DMの共有画像2枚を保存しました。XやInstagramの投稿画面から画像を選択してください。'
        : '画像を保存しました。XやInstagramの投稿画面から画像を選択してください。';
      await showSiteDialog(message, '共有画像');
    }
  } catch (e) {
    if (e?.name !== 'AbortError') {
      await showSiteDialog('共有に失敗しました: ' + e.message, 'エラー');
    }
  }
}

async function getMyPrivateScoreComments() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new Map();

  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('user_scores')
      .select('id,private_comment')
      .eq('user_id', userData.user.id)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      // SQL未適用時でもアプリ全体を止めず、コメント機能だけ無効にする。
      console.warn('曲コメント取得失敗:', error);
      return new Map();
    }

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return new Map(rows.map(row => [row.id, row.private_comment || '']));
}

async function savePrivateScoreComment({ scoreId = null, songId = null, requestId = null, comment = '' }) {
  const normalized = String(comment || '').trim();
  if (normalized.length > 100) {
    throw new Error('コメントは100文字以内で入力してください。');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('ログイン情報を取得できません。');

  let query = supabase
    .from('user_scores')
    .update({ private_comment: normalized || null })
    .eq('user_id', userData.user.id);

  if (scoreId) {
    query = query.eq('id', scoreId);
  } else if (songId) {
    query = query.eq('song_id', songId);
  } else if (requestId) {
    query = query.eq('song_request_id', requestId);
  } else {
    throw new Error('コメント保存対象の登録データを特定できません。');
  }

  const { error } = await query;
  if (error) throw error;
}

let previousScoreSettingsRequestSeq = 0;

async function applyPreviousScoreSettings(title, part) {
  if (editingScoreId) return;

  const requestSeq = ++previousScoreSettingsRequestSeq;
  const versionId = activeVersionId;
  const cleanTitle = String(title || '').trim();
  const cleanPart = String(part || '');

  // 前の曲・パートから値が残らないよう、取得前に初期値へ戻す。
  // GFは機能設定で保存したデフォルトオプションを維持し、
  // 過去データが見つかった場合だけ、その曲の設定で上書きする。
  $('formOption').value = activeInstrument === 'GF'
    ? getGfDefaultOption()
    : 'NORMAL';
  $('formDmOption').value = 'NORMAL';
  $('formPrivateComment').value = '';
  const initialOption = $('formOption').value;
  const initialDmOption = $('formDmOption').value;
  const initialComment = $('formPrivateComment').value;

  if (!cleanTitle || !cleanPart || !versionId) return;

  try {
    const { data, error } = await supabase.rpc('get_my_previous_score_settings', {
      p_title: cleanTitle,
      p_part: cleanPart,
      p_version_id: versionId
    });
    if (error) throw error;

    if (
      requestSeq !== previousScoreSettingsRequestSeq ||
      editingScoreId ||
      versionId !== activeVersionId ||
      cleanTitle !== $('formTitle').value.trim() ||
      cleanPart !== $('partSelect').value
    ) {
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    const option = String(row.play_option || 'NORMAL');
    const allowedOptions = ['NORMAL','RAN','SRA','RAN+','SRA+'];
    if (activeInstrument === 'DM') {
      if ($('formDmOption').value === initialDmOption) {
        $('formDmOption').value = option === 'BASS_MIRROR'
          ? 'BASS_MIRROR'
          : 'NORMAL';
      }
    } else if ($('formOption').value === initialOption) {
      $('formOption').value = allowedOptions.includes(option) ? option : 'NORMAL';
    }

    if ($('formPrivateComment').value === initialComment) {
      $('formPrivateComment').value = String(row.private_comment || '').slice(0, 100);
    }
  } catch (error) {
    // SQL適用前でも登録自体は止めず、引き継ぎだけを無効にする。
    console.warn('前バージョン設定の取得失敗:', error);
  }
}

async function loadScores() {
  try {
    scores = await getMyScores(activeVersionId);

    // private_commentは既存VIEWを変更せずuser_scoresから自分の分だけ取得して結合。
    const commentMap = await getMyPrivateScoreComments();
    scores = scores.map(row => ({
      ...row,
      private_comment: commentMap.get(row.score_id) || ''
    }));

    render();
  } catch (e) {
    console.error(e);
    await showSiteDialog('データ取得に失敗しました: ' + e.message, 'データ取得エラー');
  }
}


function getOwnSkillTargetRows(instrument = activeInstrument) {
  const bestByTitle = new Map();
  const instrumentPartSet = new Set(partsForInstrument(instrument));

  for (const row of scores) {
    if (!instrumentPartSet.has(String(row.part || ''))) continue;
    if (row.pending_master) continue;
    if (/\(CLASSIC\)\s*$/i.test(String(row.title || ''))) continue;

    const current = bestByTitle.get(row.title);
    if (!current || Number(row.skill) > Number(current.skill)) {
      bestByTitle.set(row.title, row);
    }
  }

  return Array.from(bestByTitle.values())
    .sort((a, b) => Number(b.skill) - Number(a.skill));
}

function calcTargetTotals(targetRows) {
  const sorted = [...targetRows].sort((a, b) => Number(b.skill) - Number(a.skill));
  const hotRows = sorted.filter(r => r.is_hot).slice(0, 25);
  const otherRows = sorted.filter(r => !r.is_hot).slice(0, 25);

  const hot = hotRows.reduce((sum, row) => sum + Number(row.skill), 0);
  const other = otherRows.reduce((sum, row) => sum + Number(row.skill), 0);

  return { hot, other, total: hot + other, hotRows, otherRows };
}

function totals(instrument = activeInstrument) {
  return calcTargetTotals(getOwnSkillTargetRows(instrument));
}


function getTotalSkillRank(totalValue) {
  return getSkillColorRowByTotalValue(totalValue).rank;
}

function getSongSkillRank(skillValue) {
  // 曲別Skillは×50した値をTOTALスキル帯へ変換し、同じカラーテーブルを使う。
  return getSkillColorRowByTotalValue((Number(skillValue) || 0) * 50).rank;
}

function tintHeaderValues(hot, other, total) {
  const totalRank = getTotalSkillRank(total);
  const rankClass = `score-rank-${totalRank}`;

  const allRankClasses = [
    'score-rank-white',
    'score-rank-orange',
    'score-rank-orange-grad',
    'score-rank-yellow',
    'score-rank-yellow-grad',
    'score-rank-green',
    'score-rank-green-grad',
    'score-rank-blue',
    'score-rank-blue-grad',
    'score-rank-purple',
    'score-rank-purple-grad',
    'score-rank-red',
    'score-rank-red-grad',
    'score-rank-bronze',
    'score-rank-silver',
    'score-rank-gold',
    'score-rank-rainbow',
    'score-rank-deep-rainbow',
    'score-rank-sparkle-rainbow',
    'm-gold-text',
    'm-rainbow-text'
  ];

  ['txtGrandTotal', 'txtHotTotal', 'txtOtherTotal'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.remove(...allRankClasses);
    // TOTALで決まった帯色をHOT / OTHERにも連動させる。
    el.classList.add(rankClass);
  });
}

function getPartColorClass(part) {
  if (part.startsWith('MAS')) return 'p-mas';
  if (part.startsWith('EXT')) return 'p-ext';
  if (part.startsWith('ADV')) return 'p-adv';
  if (part.startsWith('BSC')) return 'p-bsc';
  return '';
}

function getFcBadgeMarkup(fc, achievementRate = null) {
  const rate = Number(achievementRate);
  const value = Number.isFinite(rate) && rate === 100
    ? 'EXC'
    : String(fc || '').toUpperCase();

  if (value !== 'FC' && value !== 'EXC') return '';
  const cls = value === 'EXC' ? 'exc' : 'fc';
  return `<span class="fc-unified-badge ${cls}">${value}</span>`;
}

function getOptionBadgeMarkup(option) {
  const value = String(option || 'NORMAL').toUpperCase();
  if (value === 'NORMAL') return '';
  const cls =
    value === 'RAN' ? 'opt-ran' :
    value === 'SRA' ? 'opt-sra' :
    value === 'RAN+' ? 'opt-ran-plus' :
    value === 'SRA+' ? 'opt-sra-plus' :
    value === 'BASS_MIRROR' ? 'opt-bass-mirror' : '';
  if (!cls) return '';
  const label = value === 'BASS_MIRROR' ? 'バスミラー' : value;
  return `<span class="opt-badge ${cls}">${esc(label)}</span>`;
}

function getHotTagMarkup(isHot) {
  return isHot ? '<span class="hot-tag">HOT</span>' : '';
}

function createCard(record, index, mode = 'MANAGE') {
  const skill = Number(record.skill);
  const fcBadge = getFcBadgeMarkup(record.fc, record.achievement_rate);
  const optionBadge = getOptionBadgeMarkup(record.play_option);
  const hotTag = getHotTagMarkup(record.is_hot);
  const pendingTag = record.pending_master ? '<span class="pending-badge">申請中</span>' : '';

  const songRank = getSongSkillRank(skill);
  const boxColor = `skill-box-${songRank}`;
  const rowColor = `skill-row-${songRank}`;

  const titleMarkup = `${pendingTag}${hotTag}<span class="dc-song-title">${esc(record.title)}</span>`;
  const partMarkup = `<span class="p-badge ${getPartColorClass(record.part)}">${esc(record.part)}</span>`;

  if (mode === 'SKILL') {
    return `
      <div class="sk-row dc-card dc-card-skill ${rowColor}"
        ${record.song_id ? `data-compare-song="${record.song_id}" data-compare-title="${esc(record.title)}" data-compare-part="${esc(record.part)}" data-compare-edit-score="${record.score_id}"` : ''}>
        <div class="dc-part">${partMarkup}</div>
        <div class="dc-title smart-song-title" data-full-title="${esc(record.title)}">${titleMarkup}</div>
        <div class="dc-skill dc-skill-span ${boxColor}"><span class="dc-skill-value">${formatSkill(skill)}</span></div>

        <div class="dc-fc">${fcBadge}</div>
        <div class="dc-lv"><span class="dc-field-label">Lv</span><strong>${formatLevel(record.level)}</strong></div>
        <div class="dc-rate"><span class="dc-field-label">達成率 </span><strong>${formatRate(record.achievement_rate)}%</strong></div>
        <div class="dc-option">${optionBadge}</div>
      </div>`;
  }

  if (mode === 'PUBLIC') {
    return `
      <div class="m-card dc-card dc-card-manage dc-card-public ${rowColor}"
        ${record.song_id ? `data-compare-song="${record.song_id}" data-compare-title="${esc(record.title)}" data-compare-part="${esc(record.part)}"` : ''}>
        <div class="dc-part">${partMarkup}</div>
        <div class="dc-title smart-song-title" data-full-title="${esc(record.title)}">${titleMarkup}</div>
        <div class="dc-skill ${boxColor}"><span class="dc-skill-value">${formatSkill(skill)}</span></div>

        <div class="dc-fc">${fcBadge}</div>
        <div class="dc-lv">Lv <strong>${formatLevel(record.level)}</strong></div>
        <div class="dc-rate"><span class="dc-field-label">達成率 </span><strong>${formatRate(record.achievement_rate)}%</strong></div>
        <div class="dc-option">${optionBadge}</div>
      </div>`;
  }

  return `
    <div class="m-card dc-card dc-card-manage ${rowColor}"
      ${record.song_id ? `data-compare-song="${record.song_id}" data-compare-title="${esc(record.title)}" data-compare-part="${esc(record.part)}"` : ''}>
      <div class="dc-part">${partMarkup}</div>
      <div class="dc-title smart-song-title" data-full-title="${esc(record.title)}">${titleMarkup}</div>
      <div class="dc-skill ${boxColor}"><span class="dc-skill-value">${formatSkill(skill)}</span></div>

      <div class="dc-fc">${fcBadge}</div>
      <div class="dc-lv">Lv <strong>${formatLevel(record.level)}</strong></div>
      <div class="dc-rate"><span class="dc-field-label">達成率 </span><strong>${formatRate(record.achievement_rate)}%</strong></div>
      <div class="dc-option">${optionBadge}</div>
      <div class="dc-edit"><button class="m-action-btn btn-e" data-edit="${record.score_id}">編集</button></div>
    </div>`;
}

function renderSkill() {
  const target = calcTargetTotals(getOwnSkillTargetRows());

  $('viewSkill').innerHTML = `
    <div class="sk-section skill-hot-section"><h2>HOT Top25</h2><div class="list-container">
      ${target.hotRows.map((r,i) => createCard(r,i+1,'SKILL')).join('') || '<div class="empty-state">まだ登録がありません</div>'}
    </div></div>
    <div class="sk-section skill-other-section"><h2>OTHER Top25</h2><div class="list-container">
      ${target.otherRows.map((r,i) => createCard(r,i+1,'SKILL')).join('') || '<div class="empty-state">まだ登録がありません</div>'}
    </div></div>`;
}

function renderRegisteredCardList(data, mode = 'MANAGE') {
  if (!document.body.classList.contains('skill-target-columns')) {
    return data.map((record, index) => createCard(record, index + 1, mode)).join('');
  }

  // 横並び表示では、左列をHOT、右列をOTHERに固定する。
  // 各列の中では、呼び出し元で確定したスキル値順を維持する。
  const hotRows = data.filter(record => Boolean(record.is_hot));
  const otherRows = data.filter(record => !record.is_hot);
  const rowCount = Math.max(hotRows.length, otherRows.length);
  const cards = [];

  for (let index = 0; index < rowCount; index += 1) {
    cards.push(
      hotRows[index]
        ? createCard(hotRows[index], index + 1, mode)
        : '<div class="record-column-placeholder" aria-hidden="true"></div>'
    );
    cards.push(
      otherRows[index]
        ? createCard(otherRows[index], index + 1, mode)
        : '<div class="record-column-placeholder" aria-hidden="true"></div>'
    );
  }

  return cards.join('');
}

function getVisibleRegisteredRows(data, batch) {
  if (!document.body.classList.contains('skill-target-columns')) {
    return data.slice(0, batch * REGISTERED_RECORD_BATCH_SIZE);
  }

  const visiblePerType = batch * REGISTERED_RECORD_COLUMN_BATCH_SIZE;
  const hotRows = data
    .filter(record => Boolean(record.is_hot))
    .slice(0, visiblePerType);
  const otherRows = data
    .filter(record => !record.is_hot)
    .slice(0, visiblePerType);

  return [...hotRows, ...otherRows]
    .sort((a,b) => Number(b.skill) - Number(a.skill));
}

function renderManage() {
  const keyword = $('domSearch').value.trim().toLowerCase();
  const typeFilter = document.body.classList.contains('skill-target-columns')
    ? ''
    : ($('recordTypeFilter')?.value || '');
  const clearRankFilter = $('recordClearRankFilter')?.value || '';
  const fcFilter = $('recordFcFilter')?.value || '';
  const columnMode = document.body.classList.contains('skill-target-columns') ? 'COLUMNS' : 'LIST';
  const viewKey = [activeInstrument, columnMode, keyword, typeFilter, clearRankFilter, fcFilter].join('\u0000');
  if (viewKey !== ownRegisteredViewKey) {
    ownRegisteredViewKey = viewKey;
    ownRegisteredBatch = 1;
  }

  const data = scores
    .filter(r => isCurrentInstrumentPart(r.part))
    .filter(r => !keyword || r.title.toLowerCase().includes(keyword))
    .filter(r => {
      if (typeFilter === 'HOT') return Boolean(r.is_hot);
      if (typeFilter === 'OTHER') return !r.is_hot;
      return true;
    })
    .filter(r => {
      const achievementRate = Number(r.achievement_rate);
      const fc = String(r.fc || '').toUpperCase();

      // EXCは達成率100%が前提のため、クリアランクより優先する。
      if (fcFilter === 'EXC') return fc === 'EXC';

      const matchesClearRank = (() => {
        if (clearRankFilter === 'SS') return achievementRate >= 95 && achievementRate <= 100;
        if (clearRankFilter === 'S') return achievementRate >= 80 && achievementRate < 95;
        if (clearRankFilter === 'BELOW_S') return achievementRate < 80;
        return true;
      })();
      const matchesFc =
        fcFilter === 'FC'
          ? fc === 'FC'
          : fcFilter === 'NONE'
            ? fc !== 'FC' && fc !== 'EXC'
            : true;

      return matchesClearRank && matchesFc;
    })
    .sort((a,b) => Number(b.skill) - Number(a.skill));

  const visibleRows = getVisibleRegisteredRows(data, ownRegisteredBatch);
  const hasMore = visibleRows.length < data.length;

  $('viewAllManage').innerHTML =
    (renderRegisteredCardList(visibleRows) ||
      '<div class="empty-state">条件に一致する登録データがありません</div>') +
    (hasMore ? `
      <div class="user-detail-records-more own-registered-records-more">
        <span>${visibleRows.length} / ${data.length}件表示</span>
        <button type="button" data-own-records-more>もっと見る</button>
      </div>` : '');

  requestAnimationFrame(syncRegisteredEditButtonWidths);
}

function syncRegisteredEditButtonWidths() {
  document.querySelectorAll('#viewAllManage .dc-card-manage').forEach(card => {
    const skillBox = card.querySelector('.dc-skill');
    const editButton = card.querySelector('.dc-edit .m-action-btn.btn-e');
    if (!skillBox || !editButton) return;

    const width = skillBox.getBoundingClientRect().width;
    if (!Number.isFinite(width) || width <= 0) return;

    const cssWidth = `${width}px`;
    editButton.style.setProperty('width', cssWidth, 'important');
    editButton.style.setProperty('min-width', cssWidth, 'important');
    editButton.style.setProperty('max-width', cssWidth, 'important');
  });
}

function render() {
  // 表示設定を再評価する。CSS側でスキル対象コンテナだけに限定しているため、
  // 登録曲タブには横並びレイアウトを適用しない。
  applyDisplayCustomization();

  const t = totals();
  $('txtHotTotal').textContent = formatSkill(t.hot);
  $('txtOtherTotal').textContent = formatSkill(t.other);
  $('txtGrandTotal').textContent = formatSkill(t.total);
  tintHeaderValues(t.hot,t.other,t.total);

  hide('viewSkill');
  hide('viewAllManage');
  hide('viewUsers');

  if (activeTabName === 'SKILL') {
    show('viewSkill');
    renderSkill();
  } else if (activeTabName === 'RECORDS') {
    show('viewAllManage');
    renderManage();
  } else {
    show('viewUsers');
    loadUsers();
  }
}

function switchTab(tab) {
  if (tab === 'RECORDS' && activeTabName !== 'RECORDS') {
    ownRegisteredBatch = 1;
    ownRegisteredViewKey = '';
  }
  activeTabName = tab;
  syncUserListHeaderVisibility();
  document.querySelectorAll('.p-tab-btn').forEach(
    b => b.classList.toggle('active', b.dataset.tab === tab)
  );

  $('domSearch').value = '';
  $('searchArea').classList.toggle('hidden', tab !== 'RECORDS');
  scrollMainPageTo(0);
  render();
}

function openScoreModal(score = null) {
  previousScoreSettingsRequestSeq++;
  editingScoreId = score?.score_id || null;
  selectedSong = score?.song_id ? {
    id: score.song_id,
    title: score.title,
    part: score.part,
    level: score.level,
    is_hot: score.is_hot
  } : null;

  $('domModalTitle').textContent = score ? '登録情報の編集' : 'スコア登録';
  $('formTitle').value = score?.title || '';
  $('partSelect').innerHTML = instrumentPartOptionsHtml();
  $('partSelect').value = score?.part || instrumentParts()[0];
  $('formLevel').value = score ? formatLevel(score.level) : '';
  $('formRate').value = score ? formatRate(score.achievement_rate) : '';
  $('formFc').value = score?.fc === 'FC' ? 'FC' : '';
  $('formOption').value = activeInstrument === 'DM'
    ? 'NORMAL'
    : (score?.play_option || getGfDefaultOption());
  updateDmBassMirrorFieldVisibility();
  $('formDmOption').value =
    activeInstrument === 'DM' &&
    score?.play_option === 'BASS_MIRROR'
      ? 'BASS_MIRROR'
      : 'NORMAL';
  $('formSkill').textContent = score ? formatSkill(score.skill) : '-';

  // コメントは本人だけが入力・参照できる非公開項目。
  $('scorePrivateCommentGroup').classList.remove('hidden');
  $('formPrivateComment').value = score?.private_comment || '';

  $('songSuggestions').innerHTML = '';
  if ($('adminSongInitialFilter')) $('adminSongInitialFilter').value = '';
  if ($('adminSongCandidate')) $('adminSongCandidate').value = '';
  $('btnSubmitForm').textContent = '保存する';
  $('editDeleteArea').classList.toggle('hidden', !score);
  hide('masterRequestArea');
  hide('levelCorrectionArea');
  hide('levelCorrectionForm');
  $('correctionLevel').value = '';
  if (selectedSong) show('levelCorrectionArea');

  // iOS Safariではモーダル内のinputにフォーカスすると、
  // 背景ページ側のスクロール位置まで動くことがある。
  // 開く前の位置を保存してbodyを固定し、背景を一切動かさない。
  scoreModalScrollY = getMainPageScrollTop();
  document.body.classList.add('score-modal-open');
  if (!getAppScroller()) {
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scoreModalScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  $('domModal').style.display = 'flex';

  prepareAdminSongPicker().catch(console.error);

  if (!score) {
    requestAnimationFrame(() => $('formTitle').focus({ preventScroll: true }));
  }
}

function closeModal() {
  previousScoreSettingsRequestSeq++;
  // iOS Safariではキーボードを閉じた直後にVisualViewportと
  // ページレイアウトの再計算がずれることがあるため、
  // blur → body固定解除 → 再描画 → scroll復元の順で処理する。
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  $('domModal').style.display = 'none';
  document.body.classList.remove('score-modal-open');

  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';

  const restoreY = scoreModalScrollY;

  editingScoreId = null;
  selectedSong = null;

  // 登録一覧を一度再描画して、Safariに残った不正なレイアウトキャッシュを破棄。
  render();

  const repairViewport = () => {
    // 一時的に再フローを強制
    document.documentElement.classList.add('ios-viewport-repair');
    void document.documentElement.offsetHeight;
    document.documentElement.classList.remove('ios-viewport-repair');

    scrollMainPageTo(restoreY);
  };

  repairViewport();
  requestAnimationFrame(() => {
    repairViewport();
    requestAnimationFrame(repairViewport);
  });

  // キーボードが完全に閉じた後にも最終補正
  setTimeout(repairViewport, 120);

  requestAnimationFrame(syncGlobalModalScrollLock);
}

let songSuggestRequestSeq = 0;
let songSuggestTimer = null;

async function suggestSongs() {
  const requestSeq = ++songSuggestRequestSeq;
  const title = $('formTitle').value.trim();
  const currentPart = $('partSelect').value;
  const versionId = activeVersionId;
  const instrument = activeInstrument;

  selectedSong = null;
  if (!editingScoreId) {
    previousScoreSettingsRequestSeq++;
    $('formOption').value = activeInstrument === 'GF'
      ? getGfDefaultOption()
      : 'NORMAL';
    $('formDmOption').value = 'NORMAL';
    $('formPrivateComment').value = '';
  }
  $('formLevel').value = '';
  $('formLevel').readOnly = true;
  hide('masterRequestArea');
  hide('levelCorrectionArea');
  hide('levelCorrectionForm');
  updateSkillPreview();

  if (!title) {
    $('songSuggestions').innerHTML = '';
    return;
  }

  try {
    // 候補検索と完全一致確認を並列で実行して待ち時間を短縮する。
    const [rows, exactCurrentSong] = await Promise.all([
      searchSongTitles(title, instrument, versionId),
      currentPart
        ? getSongByTitleAndPart(title, currentPart, versionId)
        : Promise.resolve(null)
    ]);

    // 文字入力中に古い検索結果が後から返ってきても画面へ反映しない。
    // 例：「一網」検索の応答が「一網打尽」検索より後に返るケースを防止。
    if (
      requestSeq !== songSuggestRequestSeq ||
      $('formTitle').value.trim() !== title ||
      $('partSelect').value !== currentPart ||
      activeVersionId !== versionId ||
      activeInstrument !== instrument
    ) {
      return;
    }

    // 完全一致する曲名は候補の先頭へ。
    const sortedRows = [...(rows ?? [])].sort((a, b) => {
      const aExact = String(a.title || '') === title ? 1 : 0;
      const bExact = String(b.title || '') === title ? 1 : 0;
      return bExact - aExact;
    });

    const suggestionHtml = sortedRows.map(r => `
      <button class="suggestion"
        data-title="${esc(r.title)}"
        data-is-hot="${r.is_hot ? '1':'0'}">
        <span>${r.is_hot ? '[HOT] ' : ''}${esc(r.title)}</span>
      </button>`).join('');

    // 現在の「曲名 + Part」がマスターに完全一致している場合は
    // 新規登録依頼を絶対に表示しない。
    const requestHtml = exactCurrentSong ? '' : `
      <button class="suggestion request-suggestion"
        data-request-title="${esc(title)}">
        <span>＋「${esc(title)}」を曲マスターへ登録依頼</span>
      </button>`;

    $('songSuggestions').innerHTML = suggestionHtml + requestHtml;

    // 入力途中の完全一致では自動確定しない。
    // Flow → Flower のように続けて入力できる仕様を維持する。
    selectedSong = null;
    $('formLevel').value = '';
    $('formLevel').readOnly = true;
    hide('levelCorrectionArea');
    hide('levelCorrectionForm');
    hide('masterRequestArea');
    updateSkillPreview();
  } catch (e) {
    if (requestSeq === songSuggestRequestSeq) {
      console.error(e);
    }
  }
}

function scheduleSongSuggestions() {
  clearTimeout(songSuggestTimer);
  songSuggestTimer = setTimeout(() => {
    suggestSongs();
  }, 60);
}

async function selectSongTitle(title) {
  $('formTitle').value = title;
  $('songSuggestions').innerHTML = '';
  await refreshSelectedPart();
}

async function refreshSelectedPart() {
  const title = $('formTitle').value.trim();
  const part = $('partSelect').value;

  selectedSong = null;
  $('formLevel').value = '';
  $('formLevel').readOnly = true;
  hide('masterRequestArea');
  hide('levelCorrectionArea');
  hide('levelCorrectionForm');
  $('correctionLevel').value = '';

  if (!title || !part) {
    updateSkillPreview();
    return;
  }

  try {
    const song = await getSongByTitleAndPart(title, part, activeVersionId);
    if (song) {
      selectedSong = song;
      $('formLevel').value = formatLevel(song.level);
      $('formLevel').readOnly = true;
      $('btnSubmitForm').textContent = '保存する';
      hide('masterRequestArea');
      show('levelCorrectionArea');
    } else {
      setMissingMasterState();
    }
  } catch (e) {
    console.error(e);
    setMissingMasterState();
  }

  await applyPreviousScoreSettings(title, part);
  updateSkillPreview();
}

function setMissingMasterState() {
  selectedSong = null;
  $('formLevel').readOnly = false;
  $('formLevel').placeholder = '登録依頼する難易度';
  $('btnSubmitForm').textContent = '登録依頼して保存';
  show('masterRequestArea');
  hide('levelCorrectionArea');
  hide('levelCorrectionForm');
  updateSkillPreview();
}

function updateSkillPreview() {
  const level = Number($('formLevel').value);
  const rateText = $('formRate').value;
  const rate = Number(rateText);

  $('formSkill').textContent =
    $('formLevel').value && rateText !== '' && Number.isFinite(level) && Number.isFinite(rate)
      ? formatSkill(calcSkill(level,rate))
      : '-';
}

async function submitScore() {
  const title = $('formTitle').value.trim();
  const part = $('partSelect').value;
  const rate = $('formRate').value;

  if (!title) throw new Error('曲名を入力してください。');
  if (rate === '') throw new Error('達成率を入力してください。');

  if (!selectedSong || selectedSong.title !== title || selectedSong.part !== part) {
    selectedSong = await getSongByTitleAndPart(title, part, activeVersionId);
  }

  let songId = selectedSong?.id || null;
  let requestId = null;

  // マスター未登録なら、申請とスコア保存を同時に行う
  if (!songId) {
    const level = $('formLevel').value;
    if (!level) throw new Error('登録依頼する難易度を入力してください。');

    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel) || numericLevel <= 0 || numericLevel > 9.99) {
      throw new Error('難易度は0.01～9.99の範囲で入力してください。');
    }

    const request = await requestSongMaster({
      title,
      part,
      proposedLevel: level,
      versionId: activeVersionId
    });

    // 申請直前の再照合で既存マスターが見つかった場合は、
    // 新規申請を作らず既存song_idへ保存する。
    if (request?.existing_song_id) {
      songId = request.existing_song_id;
      selectedSong = {
        id: request.existing_song_id,
        title: request.title,
        part: request.part,
        level: request.level,
        is_hot: request.is_hot
      };
    } else {
      requestId = request.id;
    }
  }

  const numericRate = Number(rate);
  const autoFc = numericRate === 100 ? 'EXC' : $('formFc').value;
  const playOption = activeInstrument === 'DM'
    ? ($('formDmOption').value === 'BASS_MIRROR' ? 'BASS_MIRROR' : 'NORMAL')
    : $('formOption').value;

  await saveScore({
    scoreId: editingScoreId,
    songId,
    requestId,
    achievementRate: rate,
    fc: autoFc,
    playOption
  });

  await savePrivateScoreComment({
    scoreId: editingScoreId,
    songId,
    requestId,
    comment: $('formPrivateComment').value
  });

  await recordMyActivity('EDIT');
  closeModal();
  await loadScores();
}

/* ---------- マイページ ---------- */

function formatDateOnly(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

let userListLoadSeq = 0;

async function loadUsers({ resetPage = false } = {}) {
  const requestSeq = ++userListLoadSeq;
  const keyword = $('userSearch')?.value || '';
  const instrument = activeInstrument;
  const versionId = activeVersionId;

  try {
    const rows = await listUserSummaries(keyword, instrument, versionId);

    // 古い再取得結果が後から返ってきても現在の表示を巻き戻さない。
    if (
      requestSeq !== userListLoadSeq ||
      instrument !== activeInstrument ||
      versionId !== activeVersionId ||
      keyword !== ($('userSearch')?.value || '')
    ) {
      return;
    }

    publicUsers = rows;

    // 検索・VERSION変更・楽器変更など、明示的な条件変更時だけ1ページ目へ。
    // focus/visibilitychange等の自動再取得では現在ページを維持する。
    if (resetPage) userListPage = 0;

    renderUsers();
  } catch (e) {
    if (requestSeq !== userListLoadSeq) return;
    $('userList').innerHTML = `<div class="empty-state">ユーザーリストの取得に失敗しました: ${esc(e.message)}</div>`;
  }
}

function buildUserListPager(totalPages) {
  if (totalPages <= 1) return '';

  const pageOptions = Array.from({ length: totalPages }, (_, index) => `
    <option value="${index}" ${index === userListPage ? 'selected' : ''}>
      ${index + 1} / ${totalPages}
    </option>`).join('');

  return `
    <button type="button" class="user-pager-arrow" data-user-page="prev"
      ${userListPage <= 0 ? 'disabled' : ''} aria-label="前のページ">◀</button>
    <label class="user-pager-jump" aria-label="ページを選択">
      <select data-user-page-select>${pageOptions}</select>
    </label>
    <button type="button" class="user-pager-arrow" data-user-page="next"
      ${userListPage + 1 >= totalPages ? 'disabled' : ''} aria-label="次のページ">▶</button>
  `;
}

function syncUserListSortControls() {
  const keySelect = $('userListSortKey');
  const directionSelect = $('userListSortDirection');
  if (keySelect) keySelect.value = userListSort.key;
  if (directionSelect) directionSelect.value = userListSort.dir;
}

function renderUsers() {
  const { key, dir } = userListSort;
  const sign = dir === 'asc' ? 1 : -1;
  syncUserListSortControls();

  const users = [...publicUsers].sort((a, b) => {
    const gfA = Number(a.gf_skill) || 0, gfB = Number(b.gf_skill) || 0;
    const dmA = Number(a.dm_skill) || 0, dmB = Number(b.dm_skill) || 0;
    const totalA = gfA + dmA, totalB = gfB + dmB;
    const nameA = String(a.username || ''), nameB = String(b.username || '');
    const compareNameAsc = () => nameA.localeCompare(nameB, 'ja');

    if (key === 'gf' || key === 'dm') {
      const primaryA = key === 'gf' ? gfA : dmA;
      const primaryB = key === 'gf' ? gfB : dmB;
      const primaryResult = (primaryA - primaryB) * sign;
      if (primaryResult) return primaryResult;

      // GF/DMが同値ならTOTAL、さらに同値ならユーザー名で順序を固定する。
      const totalResult = (totalA - totalB) * sign;
      return totalResult || compareNameAsc();
    }

    if (key === 'total') {
      return (totalA - totalB) * sign || compareNameAsc();
    }

    return dir === 'asc'
      ? compareNameAsc()
      : nameB.localeCompare(nameA, 'ja');
  });

  const totalPages = Math.max(1, Math.ceil(users.length / USER_LIST_PAGE_SIZE));
  if (userListPage >= totalPages) userListPage = totalPages - 1;

  const pageStart = userListPage * USER_LIST_PAGE_SIZE;
  const pageUsers = users.slice(pageStart, pageStart + USER_LIST_PAGE_SIZE);

  $('userList').innerHTML = pageUsers.map(user => {
    const gf = Number(user.gf_skill) || 0;
    const dm = Number(user.dm_skill) || 0;
    const combined = gf + dm;
    const gfClass = `score-rank-${getTotalSkillRank(gf)}`;
    const dmClass = `score-rank-${getTotalSkillRank(dm)}`;
    // TOTALの色はGF/DMのうち高い方のスキルカラーを採用する。
    const totalClass = `score-rank-${getTotalSkillRank(Math.max(gf, dm))}`;
    const rivalLabel = `${activeInstrument}ライバル`;

    return `
      <div class="user-list-row user-list-row-${getTotalSkillRank(Math.max(gf, dm))}" data-user-open="${user.user_id}" data-user-name="${esc(user.username)}">
        <div class="user-list-name">${esc(user.username)}${user.is_self ? '（自分）' : ''}</div>
        <div class="user-list-skill user-list-gf"><div class="user-list-skill-value ${gfClass}">${formatSkill(gf)}</div></div>
        <div class="user-list-skill user-list-dm"><div class="user-list-skill-value ${dmClass}">${formatSkill(dm)}</div></div>
        <div class="user-list-skill user-list-total"><span class="user-list-skill-value ${totalClass}">${formatSkill(combined)}</span></div>
        ${user.is_self
          ? '<div></div>'
          : `<button class="favorite-toggle ${user.is_favorite ? 'active' : ''}"
              data-favorite-user="${user.user_id}"
              data-favorite-instrument="${activeInstrument}"
              title="${rivalLabel}">${user.is_favorite ? '★' : '☆'}</button>`}
      </div>`;
  }).join('') || '<div class="empty-state">該当するユーザーがいません</div>';

  const pager = $('userListPager');
  if (pager) {
    if (!users.length || totalPages <= 1) {
      pager.innerHTML = users.length
        ? `<span class="user-list-page-summary">${users.length}件</span>`
        : '';
    } else {
      pager.innerHTML = `
        <div class="user-pager-main">${buildUserListPager(totalPages)}</div>
        <div class="user-list-page-summary">${users.length}件</div>
      `;
    }
  }
}

function renderViewedUserSkill() {
  const target = calcTargetTotals(viewedUserScores);

  $('userDetailHot').textContent = formatSkill(target.hot);
  $('userDetailOther').textContent = formatSkill(target.other);
  $('userDetailTotal').textContent = formatSkill(target.total);

  const rankClass = `score-rank-${getTotalSkillRank(target.total)}`;
  ['userDetailTotal', 'userDetailHot', 'userDetailOther'].forEach(id => {
    const el = $(id);
    // 自分のヘッダーと同じscore-val描画をそのまま使う。
    el.className = `score-val user-detail-skill-value ${rankClass}`;
  });

  $('userDetailSkill').innerHTML = `
    <div class="sk-section skill-hot-section"><h2>HOT Top25</h2><div class="list-container">
      ${target.hotRows.map((r,i) => createCard(r,i+1,'SKILL')).join('') || '<div class="empty-state">記録がありません</div>'}
    </div></div>
    <div class="sk-section skill-other-section"><h2>OTHER Top25</h2><div class="list-container">
      ${target.otherRows.map((r,i) => createCard(r,i+1,'SKILL')).join('') || '<div class="empty-state">記録がありません</div>'}
    </div></div>`;
}

function setUserDetailTab(tab) {
  document.querySelectorAll('[data-user-detail-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.userDetailTab === tab);
  });

  $('userDetailSkill').classList.toggle('hidden', tab !== 'skill');
  $('userDetailRecords').classList.toggle('hidden', tab !== 'records');
}

function renderViewedUserRegisteredScores() {
  const data = [...viewedUserRegisteredScores]
    .sort((a,b) => Number(b.skill) - Number(a.skill));
  const visibleRows = getVisibleRegisteredRows(data, viewedUserRegisteredBatch);
  const hasMore = visibleRows.length < data.length;

  $('userDetailRecords').innerHTML = `
    <div class="sk-section">
      <h2>登録曲 ${data.length}件（${visibleRows.length}件表示）</h2>
      <div class="list-container">
        ${renderRegisteredCardList(visibleRows, 'PUBLIC') || '<div class="empty-state">登録曲がありません</div>'}
      </div>
      ${hasMore ? `
        <div class="user-detail-records-more">
          <span>${visibleRows.length} / ${data.length}件表示</span>
          <button type="button" data-user-detail-records-more>もっと見る</button>
        </div>` : ''}
    </div>`;
}

async function loadViewedUserRegisteredScores() {
  if (!viewedUserId || !viewedUserProfile?.registration_public) return;

  $('userDetailRecords').innerHTML = '<div class="empty-state">読み込み中...</div>';

  try {
    viewedUserRegisteredScores = await getPublicUserRegisteredScores(
      viewedUserId,
      activeInstrument,
      activeVersionId
    );
    viewedUserRegisteredBatch = 1;
    renderViewedUserRegisteredScores();
  } catch (e) {
    $('userDetailRecords').innerHTML =
      `<div class="empty-state">登録曲の取得に失敗しました: ${esc(e.message)}</div>`;
  }
}

async function openUserDetail(userId, username) {
  viewedUserId = userId;
  viewedUserName = username;
  viewedUserProfile = null;
  viewedUserRegisteredScores = [];
  viewedUserRegisteredBatch = 1;

  $('userDetailName').textContent = username;
  $('userDetailSkill').innerHTML = '<div class="empty-state">読み込み中...</div>';
  $('userDetailRecords').innerHTML = '';
  $('userDetailTabs').classList.add('hidden');
  document.querySelector('.user-detail-sticky')?.classList.add('user-detail-no-tabs');
  $('userDetailXLink').classList.add('hidden');
  $('userDetailXLink').removeAttribute('href');
  setUserDetailTab('skill');
  $('userDetailPage').style.display = 'flex';

  try {
    const [skillRows, profile] = await Promise.all([
      getUserSkillTargets(userId, activeInstrument, activeVersionId),
      getUserPublicProfile(userId)
    ]);

    viewedUserScores = skillRows;
    viewedUserProfile = profile;
    renderViewedUserSkill();

    const recordsPublic = Boolean(profile?.registration_public);
    $('userDetailTabs').classList.toggle('hidden', !recordsPublic);
    document.querySelector('.user-detail-sticky')?.classList.toggle(
      'user-detail-no-tabs',
      !recordsPublic
    );

    const xId = String(profile?.x_id || '').trim();
    if (profile?.x_public && /^[A-Za-z0-9_]{1,15}$/.test(xId)) {
      const link = $('userDetailXLink');
      link.href = `https://x.com/${encodeURIComponent(xId)}`;
      link.title = `@${xId}`;
      link.classList.remove('hidden');
    }
  } catch (e) {
    $('userDetailSkill').innerHTML =
      `<div class="empty-state">取得に失敗しました: ${esc(e.message)}</div>`;
  }
}

function closeUserDetail() {
  $('userDetailPage').style.display = 'none';
  viewedUserScores = [];
  viewedUserRegisteredScores = [];
  viewedUserRegisteredBatch = 1;
  viewedUserProfile = null;
  viewedUserId = null;
  viewedUserName = '';
  $('userDetailXLink').classList.add('hidden');
  $('userDetailTabs').classList.add('hidden');
  setUserDetailTab('skill');
}

async function toggleFavorite(userId, instrument = activeInstrument) {
  const user = publicUsers.find(u => u.user_id === userId);
  if (!user) return;

  const isRemoving = Boolean(user.is_favorite && instrument === activeInstrument);

  try {
    if (isRemoving) {
      await removeFavorite(userId, instrument);
    } else {
      // 11人目はDBへ登録処理を投げる前に止める。
      // getMyFavorites() を直接取得して判定することで、
      // 画面側のキャッシュ件数に依存しないようにする。
      const currentFavorites = await getMyFavorites(instrument);
      if ((currentFavorites ?? []).length >= 10) {
        await showSiteDialog('登録人数上限です。', 'ライバル登録');
        return;
      }

      const { error: addError } = await supabase.rpc('add_favorite_v2', {
        p_favorite_user_id: userId,
        p_instrument: instrument
      });
      if (addError) throw addError;
    }

    await Promise.all([loadUsers(), loadFavorites()]);
  } catch (e) {
    const message = String(e?.message || e);

    // 同時操作などで事前判定をすり抜けてDB側の10人制限に
    // 到達した場合も、同じ上限メッセージに統一する。
    if (
      /5件|5人|10件|10人|上限|limit|maximum|max favorites|too many|RIVAL_LIMIT_REACHED/i.test(message)
    ) {
      await showSiteDialog('登録人数上限です。', 'ライバル登録');
    } else {
      console.error('ライバル登録エラー:', e);
      await showSiteDialog(
        `ライバル登録の更新に失敗しました。\n${message}`,
        'エラー'
      );
    }
  }
}

async function loadFavorites() {
  try {
    const [gf, dm] = await Promise.all([
      getMyFavorites('GF'),
      getMyFavorites('DM')
    ]);

    const enrich = async (rows, instrument) => {
      return Promise.all((rows ?? []).map(async fav => {
        try {
          const targetRows = await getUserSkillTargets(
            fav.favorite_user_id,
            instrument,
            activeVersionId
          );
          const target = calcTargetTotals(targetRows);
          return { ...fav, total_skill: target.total };
        } catch (error) {
          console.warn(`${instrument}ライバルスキル取得失敗:`, fav.favorite_user_id, error);
          return { ...fav, total_skill: null };
        }
      }));
    };

    const [gfWithSkill, dmWithSkill] = await Promise.all([
      enrich(gf, 'GF'),
      enrich(dm, 'DM')
    ]);

    favoriteUsers = { GF: gfWithSkill, DM: dmWithSkill };
    renderFavorites();
  } catch (e) {
    $('favoriteUserListGF').innerHTML = `<div class="empty-state">GFライバルの取得に失敗しました</div>`;
    $('favoriteUserListDM').innerHTML = `<div class="empty-state">DMライバルの取得に失敗しました</div>`;
    console.error(e);
  }
}

function renderFavoriteList(instrument) {
  const rows = [...(favoriteUsers[instrument] || [])].sort((a, b) => {
    const skillA = Number(a.total_skill);
    const skillB = Number(b.total_skill);

    const validA = Number.isFinite(skillA);
    const validB = Number.isFinite(skillB);

    if (validA && validB && skillB !== skillA) return skillB - skillA;
    if (validA !== validB) return validA ? -1 : 1;

    return String(a.username || '').localeCompare(String(b.username || ''), 'ja');
  });

  const target = $(`favoriteUserList${instrument}`);

  target.innerHTML = rows.map(fav => {
    const total = Number(fav.total_skill);
    const hasSkill = Number.isFinite(total);
    const skillClass = hasSkill
      ? `score-rank-${getTotalSkillRank(total)}`
      : '';

    return `
      <div class="favorite-user-row" data-favorite-row="${fav.favorite_user_id}">
        <button type="button"
          class="favorite-user-open"
          data-favorite-open="${fav.favorite_user_id}"
          data-favorite-name="${esc(fav.username)}"
          data-favorite-view-instrument="${instrument}">
          <span class="name">${esc(fav.username)}</span>
          <span class="favorite-user-skill-label">${instrument} TOTAL</span>
          <span class="favorite-user-skill ${skillClass}">${hasSkill ? formatSkill(total) : '-'}</span>
          <span class="favorite-user-arrow">›</span>
        </button>
        <button type="button"
          class="remove"
          data-favorite-remove="${fav.favorite_user_id}"
          data-favorite-instrument="${instrument}">削除</button>
      </div>`;
  }).join('') || `<div class="section-note">${instrument}ライバルはまだ登録されていません。</div>`;
}

function renderFavorites() {
  renderFavoriteList('GF');
  renderFavoriteList('DM');
}

async function moveFavorite(userId, direction, instrument) {
  const rows = favoriteUsers[instrument] || [];
  const index = rows.findIndex(f => f.favorite_user_id === userId);
  if (index < 0) return;

  const next = index + direction;
  if (next < 0 || next >= rows.length) return;

  const ids = rows.map(f => f.favorite_user_id);
  [ids[index], ids[next]] = [ids[next], ids[index]];

  await reorderFavorites(ids, instrument);
  await loadFavorites();
}


function getOptionDisplayName(option, part = '') {
  switch (option) {
    case 'NORMAL': return String(part).endsWith('-D') ? 'なし' : '正規';
    case 'RAN': return 'RAN';
    case 'SRA': return 'SRA';
    case 'RAN+': return 'RAN+';
    case 'SRA+': return 'SRA+';
    case 'BASS_MIRROR': return 'バスミラー';
    default: return String(option || '');
  }
}

function getHistoricalOptionMarkup(option, part) {
  if (!option || option === 'NORMAL') return '';
  const badge = getOptionBadgeMarkup(option);
  if (badge) return badge;
  return `<span class="history-option-badge">${esc(getOptionDisplayName(option, part))}</span>`;
}

function formatOptionPercentage(value) {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

async function openRateComparison(songId, title, part, editScoreId = null) {
  rateComparisonEditScoreId = editScoreId && scores.some(row => String(row.score_id) === String(editScoreId))
    ? String(editScoreId)
    : null;
  $('rateCompareTitle').textContent = `${title} / ${part}`;
  $('rateCompareEditArea')?.classList.toggle('hidden', !rateComparisonEditScoreId);
  $('btnEditRateCompare')?.classList.toggle('hidden', !rateComparisonEditScoreId);
  $('ratePrivateComment').classList.add('hidden');
  $('ratePrivateComment').textContent = '';
  $('ratePersonalBest').classList.add('hidden');
  $('ratePersonalBest').innerHTML = '';
  $('rateOptionSummary').innerHTML =
    '<div class="option-share-title">オプション利用割合を読み込み中...</div>';
  $('rateCompareBody').innerHTML = '<div class="empty-state">読み込み中...</div>';
  $('rateCompareMask').style.display = 'flex';

  try {
    // Rate比較は自分+自分が登録したライバルのみ。
    // オプション割合はライバル登録に関係なく全ユーザーを集計。
    const [rows, optionRows, personalBest] = await Promise.all([
      getSongRateComparison(songId),
      getSongOptionDistribution(songId),
      getSongPersonalBestHistory(songId)
    ]);

    // 詳細に出すコメントは常に「自分の同一譜面」のものだけ。
    // 他ユーザーのスキル対象から開いた場合でも他人のコメントは取得・表示しない。
    const ownScore = scores.find(row => row.song_id === songId);
    const ownComment = String(ownScore?.private_comment || '').trim();
    if (ownComment) {
      $('ratePrivateComment').textContent = ownComment;
      $('ratePrivateComment').classList.remove('hidden');
    }

    if (personalBest) {
      const bestBadges = [
        getFcBadgeMarkup(personalBest.fc, personalBest.achievement_rate),
        getHistoricalOptionMarkup(personalBest.play_option, part)
      ].filter(Boolean).join('');
      const bestBadgesMarkup = bestBadges
        ? `<span class="rate-personal-best-badges">${bestBadges}</span>`
        : '';
      $('ratePersonalBest').classList.remove('hidden');
      $('ratePersonalBest').innerHTML = `
        <div class="rate-personal-best-label">歴代自己ベスト</div>
        <div class="rate-personal-best-detail">
          <strong class="rate-personal-best-value">${formatRate(personalBest.achievement_rate)}%</strong>
          ${bestBadgesMarkup}
          <span class="rate-personal-best-version">(${esc(personalBest.version_name)})</span>
        </div>`;
    } else {
      $('ratePersonalBest').classList.add('hidden');
      $('ratePersonalBest').innerHTML = '';
    }

    const isDm = part.endsWith('-D');
    const visibleOptions = optionRows.filter(row => {
      if (Number(row.percentage) <= 0) return false;
      if (isDm) return ['NORMAL','BASS_MIRROR'].includes(row.play_option);
      return ['NORMAL','RAN','SRA','RAN+','SRA+'].includes(row.play_option);
    });
    const hasBassMirror = isDm && optionRows.some(row =>
      row.play_option === 'BASS_MIRROR' && Number(row.use_count) > 0
    );
    const showOptionSummary = isDm ? hasBassMirror : visibleOptions.length > 0;

    $('rateOptionSummary').innerHTML = showOptionSummary
      ? `
          <div class="option-share-title">全ユーザーのオプション利用割合</div>
          ${visibleOptions.map(row => `
            <div class="option-share-item">
              <span>${esc(getOptionDisplayName(row.play_option, part))}</span>
              <strong>${formatOptionPercentage(row.percentage)}%</strong>
            </div>`
          ).join('')}
        `
      : '';

    $('rateCompareBody').innerHTML = rows.length ? `
      ${rows.map((row, index) => {
        const compareSkillClass = `skill-box-${getSongSkillRank(Number(row.skill) || 0)}`;
        return `
          <div class="rate-row ${row.is_self ? 'self' : ''}">
            <div class="rate-user">
              <div class="rate-user-name">${esc(row.username)}${row.is_self ? '（自分）' : ''}</div>
              <div class="rate-badges">
                ${getFcBadgeMarkup(row.fc, row.achievement_rate)}
                ${getOptionBadgeMarkup(row.play_option)}
              </div>
            </div>
            <div class="rate-value">${formatRate(row.achievement_rate)}%</div>
            <div class="rate-skill ${compareSkillClass}"><span class="dc-skill-value">${formatSkill(row.skill)}</span></div>
          </div>`;
      }).join('')}
    ` : '<div class="empty-state">比較できる記録がありません</div>';
  } catch (e) {
    $('rateOptionSummary').innerHTML = '';
    $('rateCompareBody').innerHTML = `<div class="empty-state">比較データの取得に失敗しました: ${esc(e.message)}</div>`;
  }
}

function closeRateComparison() {
  $('rateCompareMask').style.display = 'none';
  rateComparisonEditScoreId = null;
  $('rateCompareEditArea')?.classList.add('hidden');
  $('btnEditRateCompare')?.classList.add('hidden');
}

async function openMyPage(fromMenu = false) {
  myPageOpenedFromMenu = Boolean(fromMenu);
  const { data } = await supabase.auth.getUser();
  $('mypageUsernameInput').value = data.user?.user_metadata?.username || $('headerUsername').textContent || '';
  $('newPassword').value = '';
  $('mypageXIdInput').value = '';
  $('mypageModal').style.display = 'flex';

  try {
    const settings = await getMyFeatureSettings();
    $('mypageXIdInput').value = settings.x_id || '';
  } catch (e) {
    console.error('X ID取得失敗:', e);
  }
}

async function changeOwnUsername() {
  const username = $('mypageUsernameInput').value.trim();
  if (!username) throw new Error('ユーザー名を入力してください。');

  const data = await accountAdmin('rename_self', { username });
  $('mypageUsernameInput').value = data.username;
  $('headerUsername').textContent = data.username;
  $('authUsername').value = data.username;
  await showSiteDialog('ユーザー名を変更しました。\n次回から新しいユーザー名でログインしてください。', '変更完了');
}

function closeMyPage(returnToPrevious = false) {
  $('mypageModal').style.display = 'none';
  if (returnToPrevious && myPageOpenedFromMenu) openMenu();
  myPageOpenedFromMenu = false;
}

async function deleteOwnAccount() {
  const ok1 = await showSiteConfirm(
    'ユーザーを削除します。登録したスコアもすべて削除されます。よろしいですか？',
    'ユーザー削除',
    '次へ'
  );
  if (!ok1) return;

  const typed = await showSitePrompt(
    '確認のため「削除」と入力してください。',
    '最終確認',
    '削除する',
    '削除'
  );
  if (typed !== '削除') {
    if (typed !== null) await showSiteDialog('「削除」と入力してください。', '入力確認');
    return;
  }

  try {
    $('btnDeleteAccount').disabled = true;
    await accountAdmin('delete_self');
    try { await logout(); } catch (_) {}
    closeMyPage();
    scores = [];
    showAuth('login');
    await showSiteDialog('ユーザーを削除しました。', '削除完了');
  } catch (e) {
    await showSiteDialog('ユーザー削除に失敗しました: ' + e.message, 'エラー');
  } finally {
    $('btnDeleteAccount').disabled = false;
  }
}

/* ---------- 管理者 ---------- */
async function checkAdminAccess() {
  try {
    adminEnabled = await isAdmin();
  } catch (e) {
    console.error('管理者判定エラー:', e);
    adminEnabled = false;
  }

  adminAccessChecked = true;
  $('btnAdmin').classList.toggle('hidden', !adminEnabled);
  $('mypageUserSwitchBlock')?.classList.remove('hidden');
  $('btnMenuSkillRanking')?.classList.remove('hidden');
  $('btnMenuSkillShareHistory')?.classList.remove('hidden');
  $('btnMenuSkillHistory')?.classList.add('hidden');
  $('btnMenuShareSkill')?.classList.add('hidden');
  $('menuOfuseSupport')?.classList.remove('hidden');
  $('scorePrivateCommentGroup')?.classList.remove('hidden');
  $('adminSongPicker')?.classList.remove('hidden');
  updateDmBassMirrorFieldVisibility();

  primaryAdminEnabled = false;
  if (adminEnabled) {
    try {
      const { data, error } = await supabase.rpc('is_primary_admin');
      if (error) throw error;
      primaryAdminEnabled = data === true;
    } catch (e) {
      console.error('primary admin check failed:', e);
    }

  }
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      rememberAdminAccountSession(
        data.session,
        $('headerUsername')?.textContent || ''
      );
    }
  } catch (e) {
    console.error('user switch session save failed:', e);
  }
  $('adminBulkDeleteArea')?.classList.toggle('hidden', !primaryAdminEnabled);

  // 保存済みの表示カスタマイズを全ユーザーに反映。
  applyDisplayCustomization();

  // 保存済みライトモード設定を全ユーザーに反映。
  applyLightMode();

}

async function adminBulkDeleteCurrentScores() {
  if (!adminEnabled || !primaryAdminEnabled) {
    await showSiteDialog('この機能はadmin専用です。', '権限エラー');
    return;
  }

  const instrumentLabel = activeInstrument === 'DM' ? 'DM' : 'GF';
  const versionLabel = activeVersion?.name || activeVersion?.code || '現在のVERSION';

  const ok = await showSiteConfirm(
    `${versionLabel} の ${instrumentLabel} 登録曲をすべて削除しますか？\nこの操作は元に戻せません。`,
    '登録曲の一括削除',
    '一括削除する'
  );
  if (!ok) return;

  const button = $('btnAdminBulkDeleteScores');
  const original = button?.textContent || '登録曲を一括削除';

  try {
    if (button) {
      button.disabled = true;
      button.textContent = '削除中...';
    }

    const { data, error } = await supabase.rpc('admin_bulk_delete_my_scores', {
      p_version_id: activeVersionId,
      p_instrument: activeInstrument
    });
    if (error) throw error;

    await loadScores();

    const deleted = Number(data) || 0;
    await showSiteDialog(
      `${instrumentLabel} の登録曲を ${deleted}件削除しました。`,
      '一括削除完了'
    );
  } catch (e) {
    await showSiteDialog(
      '一括削除に失敗しました: ' + (e?.message || e),
      'エラー'
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

async function openAdmin() {
  if (!adminEnabled) return;
  $('adminModal').style.display = 'flex';
  await switchAdminTab('songs');
}

function closeAdmin() {
  $('adminModal').style.display = 'none';
  $('adminSongFormMask').style.display = 'none';
  $('adminPasswordMask').style.display = 'none';
  $('adminCsvMask').style.display = 'none';
}

async function switchAdminTab(tab) {
  adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(
    b => b.classList.toggle('active', b.dataset.adminTab === tab)
  );
  $('adminSongToolbar').classList.toggle('hidden', tab !== 'songs');
  $('adminRequestToolbar').classList.toggle('hidden', tab !== 'requests');
  $('adminUserToolbar').classList.toggle('hidden', tab !== 'users');

  if (tab === 'songs') await loadAdminSongs();
  else if (tab === 'requests') await loadAdminRequests();
  else if (tab === 'users') await loadAdminUsers();
  else if (tab === 'feedback') await loadAdminFeedback();
  else if (tab === 'settings') await loadAdminSettingUsage();
}

function buildAdminMasterPager(totalPages) {
  if (totalPages <= 1) return '';

  const pageOptions = Array.from({ length: totalPages }, (_, index) => `
    <option value="${index}" ${index === adminSongPage ? 'selected' : ''}>
      ${index + 1} / ${totalPages}
    </option>`).join('');

  return `
    <button type="button" class="admin-master-arrow"
      data-admin-master-page="prev"
      ${adminSongPage <= 0 ? 'disabled' : ''}
      aria-label="前のページ">◀</button>
    <label class="admin-master-jump" aria-label="ページを選択">
      <select data-admin-master-page-select>${pageOptions}</select>
    </label>
    <button type="button" class="admin-master-arrow"
      data-admin-master-page="next"
      ${adminSongPage + 1 >= totalPages ? 'disabled' : ''}
      aria-label="次のページ">▶</button>`;
}

async function loadAdminSongs() {
  $('adminBody').classList.add('admin-body-table');
  $('adminBody').innerHTML = '<div class="empty-state">読み込み中...</div>';

  try {
    const keyword = $('adminSongSearch').value;
    const result = await getAdminSongMasterPage(
      keyword,
      adminSongPage,
      ADMIN_SONG_PAGE_SIZE,
      activeVersionId,
      $('adminSongTypeFilter')?.value || '',
      $('adminSongReadingFilter')?.value || ''
    );

    const rows = result.rows;
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    // 検索結果が減って現在ページが範囲外になった場合は先頭へ戻す
    if (adminSongPage >= totalPages && adminSongPage > 0) {
      adminSongPage = 0;
      return loadAdminSongs();
    }

    $('adminBody').innerHTML = `
      <div class="admin-master-summary">
        <span>${result.total.toLocaleString('ja-JP')}曲</span>
        <span>${adminSongPage + 1} / ${totalPages}ページ</span>
      </div>
      <div class="master-sheet-wrap">
        <table class="master-sheet" id="adminMasterTable">
          <thead>
            <tr>
              <th class="master-hot-cell">HOT</th>
              <th class="master-title-cell">曲名</th>
              <th class="master-reading-cell">ふりがな</th>
              <th class="master-reading-review-cell">確認</th>
              ${MASTER_PARTS.map(part => `<th class="master-level-cell">${part}</th>`).join('')}
              <th class="master-action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            ${adminNewSongRowVisible ? `
              <tr class="master-new-row" data-master-new-row>
                <td class="master-hot-cell">
                  <input type="checkbox" data-master-hot>
                </td>
                <td class="master-title-cell">
                  <input type="text" data-master-title value="" placeholder="曲名">
                </td>
                <td class="master-reading-cell">
                  <input type="text" data-master-reading value="" placeholder="漢字曲など">
                </td>
                <td class="master-reading-review-cell">
                  <input type="checkbox" data-master-reading-reviewed aria-label="ふりがな確認済み">
                </td>
                ${MASTER_PARTS.map(part => `
                  <td class="master-level-cell">
                    <input
                      type="text"
                      inputmode="decimal"
                      autocomplete="off"
                      data-master-level="${part}"
                      value=""
                      placeholder="-">
                  </td>`).join('')}
                <td class="master-action-cell">
                  <div class="master-row-actions">
                    <button class="master-row-save" data-admin-register-master-row>登録</button>
                    <button class="master-row-delete" data-admin-cancel-master-row>キャンセル</button>
                  </div>
                </td>
              </tr>` : ''}
            ${rows.map((row, index) => `
              <tr data-master-row="${index}"
                data-original-title="${esc(row.title)}"
                data-original-reading="${esc(row.reading || '')}"
                data-reading-source="${esc(row.reading_source || 'NONE')}">
                <td class="master-hot-cell">
                  <input type="checkbox" data-master-hot ${row.is_hot ? 'checked' : ''}>
                </td>
                <td class="master-title-cell">
                  <input type="text" data-master-title value="${esc(row.title)}">
                </td>
                <td class="master-reading-cell">
                  <input type="text" data-master-reading value="${esc(row.reading || '')}" placeholder="漢字曲など">
                </td>
                <td class="master-reading-review-cell" title="${row.reading_source === 'AUTO' ? '自動付与' : row.reading_source === 'MANUAL' ? '手動入力' : '曲名と同一'}">
                  <input type="checkbox" data-master-reading-reviewed
                    aria-label="ふりがな確認済み"
                    ${row.reading_reviewed ? 'checked' : ''}>
                </td>
                ${MASTER_PARTS.map(part => `
                  <td class="master-level-cell">
                    <input
                      type="text"
                      inputmode="decimal"
                      autocomplete="off"
                      data-master-level="${part}"
                      value="${row.levels?.[part] != null ? formatLevel(row.levels[part]) : ''}"
                      placeholder="-">
                  </td>`).join('')}
                <td class="master-action-cell">
                  <div class="master-row-actions">
                    <button class="master-row-save" data-admin-save-master-row="${index}">保存</button>
                    <button class="master-row-delete" data-admin-delete-master-row="${index}">削除</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-master-pager">
        ${buildAdminMasterPager(totalPages)}
      </div>`;

    if (!rows.length && !adminNewSongRowVisible) {
      $('adminBody').innerHTML = '<div class="empty-state">該当する曲がありません</div>';
      return;
    }

    const pager = $('adminBody').querySelector('.admin-master-pager');
    pager?.addEventListener('click', async event => {
      const navButton = event.target.closest('[data-admin-master-page]');
      if (!navButton || navButton.disabled) return;
      const nextPage = navButton.dataset.adminMasterPage === 'prev'
        ? adminSongPage - 1
        : adminSongPage + 1;

      if (!Number.isInteger(nextPage) || nextPage < 0 || nextPage >= totalPages) return;
      adminSongPage = nextPage;
      await loadAdminSongs();
      $('adminBody').scrollTo({ top:0, left:0, behavior:'auto' });
    });

    pager?.addEventListener('change', async event => {
      const select = event.target.closest('[data-admin-master-page-select]');
      if (!select) return;
      const nextPage = Number(select.value);
      if (!Number.isInteger(nextPage) || nextPage < 0 || nextPage >= totalPages) return;
      adminSongPage = nextPage;
      await loadAdminSongs();
      $('adminBody').scrollTo({ top:0, left:0, behavior:'auto' });
    });
  } catch (e) {
    $('adminBody').innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}

async function loadAdminRequests() {
  $('adminBody').classList.remove('admin-body-table');
  $('adminBody').innerHTML = '<div class="empty-state">読み込み中...</div>';
  try {
    adminRequests = await getPendingSongRequests($('adminRequestSearch').value, activeVersionId);
    for (const req of adminRequests) {
      if (req.request_type === 'level_correction' && req.current_song_id) {
        const { data: currentSong } = await supabase
          .from('songs')
          .select('level')
          .eq('id', req.current_song_id)
          .maybeSingle();
        req.current_level = currentSong?.level ?? null;
      }
    }
    $('adminBody').innerHTML = adminRequests.map(req => `
      <div class="admin-card">
        <div class="admin-card-top">
          ${req.request_type === 'level_correction'
            ? `<div class="admin-card-title">${esc(req.title)}</div>`
            : `<div class="admin-request-title-wrap">
                <label for="requestTitle_${req.id}">承認する曲名（修正可）</label>
                <input id="requestTitle_${req.id}"
                  class="request-title-edit"
                  type="text"
                  autocomplete="off"
                  maxlength="255"
                  value="${esc(req.title)}">
               </div>`}
          <span class="pending-badge">${req.request_type === 'level_correction' ? '難易度修正' : '新規曲'}</span>
        </div>
        <div class="admin-card-meta">
          <span>依頼パート: ${esc(req.part)}</span>
          ${req.request_type === 'level_correction' ? `<span>現在: ${formatLevel(req.current_level)}</span>` : ''}
          <span>依頼者: ${esc(req.profiles?.username || '-')}</span>
          <span>${new Date(req.created_at).toLocaleString('ja-JP')}</span>
        </div>
        <div class="request-edit-fields">
          ${req.request_type === 'new_song' ? `
            <div class="request-edit-field">
              <label for="requestPart_${req.id}">承認するパート（修正可）</label>
              <select id="requestPart_${req.id}" class="request-part-edit">
                ${PARTS.map(part => `<option value="${part}"${part === req.part ? ' selected' : ''}>${part}</option>`).join('')}
              </select>
            </div>` : ''}
          <div class="request-edit-field">
            <label for="requestLevel_${req.id}">承認する難易度（修正可）</label>
            <input
              id="requestLevel_${req.id}"
              class="request-level-edit"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              value="${formatLevel(req.proposed_level)}">
          </div>
        </div>
        <div class="request-actions">
          <button class="request-approve" data-admin-approve-request="${req.id}">修正して承認</button>
          <button class="request-hot" data-admin-hot-request="${req.id}">HOTで承認</button>
          <button class="request-reject" data-admin-reject-request="${req.id}">却下</button>
        </div>
      </div>`).join('') || '<div class="empty-state">未処理の登録依頼はありません</div>';
  } catch (e) {
    $('adminBody').innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}

async function approveEditedNewSongRequest(requestId, req, title, part, level, isHot) {
  const partChanged = part !== req.part;

  if (partChanged) {
    const { data, error } = await supabase
      .from('song_requests')
      .update({ part })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('対象の登録依頼が見つかりません。');
  }

  try {
    const { error } = await supabase.rpc('approve_song_request_with_title', {
      p_request_id: requestId,
      p_title: title,
      p_level: level,
      p_is_hot: isHot
    });
    if (error) throw error;
  } catch (error) {
    if (partChanged) {
      await supabase
        .from('song_requests')
        .update({ part: req.part })
        .eq('id', requestId)
        .eq('status', 'pending');
    }
    throw error;
  }
}

async function loadAdminUsers() {
  $('adminBody').classList.remove('admin-body-table');
  $('adminBody').innerHTML = '<div class="empty-state">読み込み中...</div>';
  try {
    adminUsers = await getAdminUsers($('adminUserSearch').value);
    const allowedKeys = new Set([
      'username', 'activity_level', 'last_open_at', 'last_update_at',
      'last_sign_in_at', 'created_at'
    ]);
    const key = allowedKeys.has(adminUserSort.key)
      ? adminUserSort.key
      : 'created_at';
    const direction = adminUserSort.dir === 'asc' ? 1 : -1;
    const activityScore = { E:1, D:2, C:3, B:4, A:5, S:6 };
    const sortedUsers = [...adminUsers].sort((a, b) => {
      if (key === 'username') {
        return String(a.username || '').localeCompare(
          String(b.username || ''), 'ja'
        ) * direction;
      }
      if (key === 'activity_level') {
        const difference = (activityScore[a.activity_level] || 0)
          - (activityScore[b.activity_level] || 0);
        if (difference) return difference * direction;
        return String(a.username || '').localeCompare(String(b.username || ''), 'ja');
      }
      const aTime = a[key] ? new Date(a[key]).getTime() : null;
      const bTime = b[key] ? new Date(b[key]).getTime() : null;
      if (aTime == null && bTime != null) return 1;
      if (aTime != null && bTime == null) return -1;
      if (aTime !== bTime) return ((aTime || 0) - (bTime || 0)) * direction;
      return String(a.username || '').localeCompare(String(b.username || ''), 'ja');
    });
    const formatAdminDate = value => value
      ? new Date(value).toLocaleString('ja-JP')
      : '記録なし';

    $('adminBody').innerHTML = `
      <div class="admin-activity-legend">
        <b>アクティブ度</b>
        <span>S：7日連続更新</span><span>A：7日連続アクセス</span>
        <span>B：更新＋通常利用</span><span>C：更新のみ</span>
        <span>D：登録後に利用</span><span>E：登録のみ</span>
      </div>
      ${sortedUsers.map(user => `
      <div class="admin-card">
        <div class="admin-card-top">
          <div class="admin-card-user-heading">
            <span class="admin-activity-badge level-${String(user.activity_level || 'E').toLowerCase()}">${esc(user.activity_level || 'E')}</span>
            <div class="admin-card-title">${esc(user.username)}</div>
          </div>
          <div class="admin-actions">
            <button class="admin-edit" data-user-open="${user.id}" data-user-name="${esc(user.username)}">詳細</button>
            <button class="admin-reset" data-admin-reset-user="${user.id}">PW変更</button>
            <button class="admin-delete" data-admin-delete-user="${user.id}">削除</button>
          </div>
        </div>
        <div class="admin-card-meta">
          <span><b>登録日時</b> ${formatAdminDate(user.created_at)}</span>
          <span><b>最終ログイン日時</b> ${formatAdminDate(user.last_sign_in_at)}</span>
          <span><b>最終アクセス</b> ${formatAdminDate(user.last_open_at)}</span>
          <span><b>最終更新</b> ${formatAdminDate(user.last_update_at)}</span>
          <span><b>直近7日</b> アクセス ${Number(user.open_days_7) || 0}日 / 更新 ${Number(user.update_days_7) || 0}日</span>
        </div>
      </div>`).join('') || '<div class="empty-state">該当するユーザーがいません</div>'}`;
  } catch (e) {
    $('adminBody').innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}

async function loadAdminSettingUsage() {
  $('adminBody').classList.remove('admin-body-table');
  $('adminBody').innerHTML = '<div class="empty-state">読み込み中...</div>';

  try {
    const rows = await getAdminFeatureSettingUsage();
    const first = rows[0] || {};
    const trackedCount = Number(first.tracked_count) || 0;
    const totalUsers = Number(first.total_users) || 0;
    const booleanRows = rows.filter(row => row.setting_key !== 'GF_DEFAULT_OPTION');
    const optionRows = rows.filter(row => row.setting_key === 'GF_DEFAULT_OPTION');
    const optionLabels = {
      NORMAL: '正規',
      RAN: 'RAN',
      SRA: 'SRA',
      'RAN+': 'RAN+',
      'SRA+': 'SRA+'
    };
    const usageCard = (label, row) => `
      <div class="admin-usage-card">
        <span>${esc(label)}</span>
        <strong>${Number(row?.usage_rate || 0).toFixed(1)}%</strong>
        <small>${Number(row?.enabled_count || 0).toLocaleString('ja-JP')} / ${trackedCount.toLocaleString('ja-JP')}人</small>
      </div>`;

    $('adminBody').innerHTML = `
      <div class="admin-usage-summary">
        <div>
          <strong>設定移行済み ${trackedCount.toLocaleString('ja-JP')} / ${totalUsers.toLocaleString('ja-JP')}人</strong>
          <small>更新版を開いたユーザーから順次集計されます。</small>
        </div>
        <button id="btnRefreshAdminSettingUsage" type="button">再読み込み</button>
      </div>
      <div class="admin-usage-section-title">表示設定</div>
      <div class="admin-usage-grid">
        ${booleanRows.map(row => usageCard(row.setting_label, row)).join('')}
      </div>
      <div class="admin-usage-section-title">GFのデフォルトオプション</div>
      <div class="admin-usage-grid admin-usage-options">
        ${optionRows.map(row => usageCard(optionLabels[row.option_value] || row.option_value, row)).join('')}
      </div>`;

    $('btnRefreshAdminSettingUsage')?.addEventListener('click', loadAdminSettingUsage);
  } catch (e) {
    $('adminBody').innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}


async function loadAdminFeedback() {
  $('adminBody').classList.remove('admin-body-table');
  $('adminBody').innerHTML = '<div class="empty-state">読み込み中...</div>';

  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('id,user_id,category,message,status,created_at,resolved_at,admin_reply,replied_at,device_name,browser_name')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    // 表示順:
    // 1. 未対応 最新 → 古い
    // 2. 対応済み 最新 → 古い
    adminFeedback = [...(data ?? [])].sort((a, b) => {
      const aDone = a.status === 'resolved' ? 1 : 0;
      const bDone = b.status === 'resolved' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    const userIds = [...new Set(adminFeedback.map(row => row.user_id).filter(Boolean))];
    const usernameMap = new Map();

    if (userIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id,username')
        .in('id', userIds);

      if (profileError) throw profileError;
      (profiles ?? []).forEach(profile => usernameMap.set(profile.id, profile.username));
    }

    $('adminBody').innerHTML = adminFeedback.map(item => {
      const isDone = item.status === 'resolved';
      const categoryLabel = item.category === 'bug' ? '不具合' : '要望';
      return `
        <div class="admin-card feedback-admin-card ${isDone ? 'resolved' : ''}">
          <div class="admin-card-top">
            <div class="admin-card-title">
              <span class="feedback-category ${item.category === 'bug' ? 'bug' : 'request'}">${categoryLabel}</span>
              ${esc(usernameMap.get(item.user_id) || 'ユーザー')}
            </div>
            <div class="admin-actions">
              <button
                class="${isDone ? 'admin-reset' : 'admin-edit'}"
                data-admin-feedback-status="${item.id}"
                data-feedback-next-status="${isDone ? 'new' : 'resolved'}">
                ${isDone ? '未対応に戻す' : '対応済みにする'}
              </button>
              <button
                class="admin-delete"
                data-admin-feedback-delete="${item.id}">
                削除
              </button>
            </div>
          </div>
          <div class="feedback-admin-message">${esc(item.message).replace(/\\n/g, '<br>')}</div>
          ${(item.device_name || item.browser_name) ? `
            <div class="feedback-admin-env">
              <strong>ご利用環境</strong><br>
              機種名：${esc(item.device_name || '未入力')}<br>
              ブラウザ：${esc(item.browser_name || '未入力')}
            </div>
          ` : ''}

          ${item.admin_reply ? `
            <div class="feedback-admin-replied">
              <strong>返信済み</strong>
              ${esc(item.admin_reply).replace(/\\n/g, '<br>')}
              ${item.replied_at ? `<div class="admin-card-meta" style="margin-top:5px;">${new Date(item.replied_at).toLocaleString('ja-JP')}</div>` : ''}
            </div>
          ` : `
            <div class="feedback-admin-reply-box">
              <div class="feedback-admin-reply-label">ユーザーへ返信（1回のみ）</div>
              <textarea
                maxlength="2000"
                data-admin-feedback-reply-input="${item.id}"
                placeholder="返信内容を入力してください"></textarea>
              <div class="feedback-admin-reply-actions">
                <button data-admin-feedback-reply="${item.id}">返信する</button>
              </div>
            </div>
          `}

          <div class="admin-card-meta">
            <span>${new Date(item.created_at).toLocaleString('ja-JP')}</span>
            <span>${item.admin_reply ? '返信済み' : (isDone ? '対応済み' : '未対応')}</span>
          </div>
        </div>`;
    }).join('') || '<div class="empty-state">要望・不具合報告はありません</div>';
  } catch (e) {
    $('adminBody').innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}

async function replyAdminFeedbackOnce(id, reply) {
  const cleanReply = String(reply || '').trim();
  if (!cleanReply) throw new Error('返信内容を入力してください。');
  if (cleanReply.length > 2000) throw new Error('返信内容は2000文字以内にしてください。');

  const { data, error } = await supabase
    .from('user_feedback')
    .update({
      admin_reply: cleanReply,
      replied_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('admin_reply', null)
    .select('id');

  if (error) throw error;
  if (!data?.length) {
    throw new Error('この報告には既に返信済みです。追加返信はできません。');
  }

  await loadAdminFeedback();
}

async function updateAdminFeedbackStatus(id, status) {
  const payload = {
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null
  };

  const { error } = await supabase
    .from('user_feedback')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
  await loadAdminFeedback();
}

async function deleteAdminFeedback(id) {
  const ok = await showSiteConfirm(
    'この要望・不具合報告を削除しますか？\n削除したデータは元に戻せません。',
    '削除確認'
  );
  if (!ok) return;

  const { error } = await supabase
    .from('user_feedback')
    .delete()
    .eq('id', id);

  if (error) throw error;
  await loadAdminFeedback();
}

function openAdminSongForm(song = null) {
  adminEditingSongId = song?.id || null;
  $('adminSongFormTitle').textContent = song ? '曲マスター編集' : '曲マスター追加';
  $('adminFormTitle').value = song?.title || '';
  $('adminFormPart').value = song?.part || 'MAS-G';
  $('adminFormLevel').value = song ? formatLevel(song.level) : '';
  $('adminFormHot').checked = Boolean(song?.is_hot);
  $('adminSongFormMask').style.display = 'flex';
}

function closeAdminSongForm() {
  $('adminSongFormMask').style.display = 'none';
  adminEditingSongId = null;
}

async function submitAdminSong() {
  await saveMasterSong({
    id: adminEditingSongId,
    isHot: $('adminFormHot').checked,
    title: $('adminFormTitle').value,
    part: $('adminFormPart').value,
    level: $('adminFormLevel').value,
    versionId: activeVersionId
  });
  closeAdminSongForm();
  await loadAdminSongs();
}

function openAdminPassword(userId) {
  const user = adminUsers.find(u => u.id === userId);
  if (!user) return;
  adminPasswordUserId = userId;
  $('adminPasswordUsername').textContent = user.username;
  $('adminPasswordValue').value = '';
  $('adminPasswordMask').style.display = 'flex';
}

function closeAdminPassword() {
  $('adminPasswordMask').style.display = 'none';
  adminPasswordUserId = null;
}

async function submitAdminPassword() {
  const password = $('adminPasswordValue').value;
  if (password.length < 8) throw new Error('パスワードは8文字以上にしてください。');
  await accountAdmin('set_password', { target_user_id: adminPasswordUserId, password });
  closeAdminPassword();
  await showSiteDialog('パスワードを変更しました。', '変更完了');
}

/* ---------- イベント ---------- */
$('authForm').addEventListener('submit', async e => {
  e.preventDefault();

  const mode = currentAuthMode;
  const username = $('authUsername').value.trim();
  const password = $('authPassword').value;
  const button = $('authSubmit');
  const defaultText = mode === 'register' ? '登録する' : 'ログイン';

  try {
    button.disabled = true;
    button.textContent = '確認中...';

    if (mode === 'register') {
      if (!validateUsername(username)) {
        throw new Error('ユーザー名は1〜32文字で入力してください。日本語も使用できます。');
      }
      if (password.length < 8) throw new Error('パスワードは8文字以上で設定してください。');
      if (password !== $('authPasswordConfirm').value) {
        throw new Error('確認用パスワードが一致していません。');
      }

      // RLSにより未ログイン時のprofiles直接検索には依存しない。
      // 重複はSupabase Auth側の結果でも判定する。
      const captchaToken = await getAuthCaptchaToken();
      button.textContent = '登録中...';
      const result = await register(username, password, captchaToken);

      if (result.user && !result.session) {
        throw new Error('Supabase側でメール確認が有効です。Confirm email をOFFにしてください。');
      }
      if (result.session) await showApp(result.session);
    } else {
      button.textContent = 'ログイン中...';
      await login(username, password, getAuthCaptchaToken, resetAuthCaptcha);
    }
  } catch (e) {
    const message = e?.message || String(e);
    const lower = message.toLowerCase();

    if (
      message.includes('User already registered') ||
      message.includes('already registered') ||
      message.includes('already been registered') ||
      message.includes('既に登録されています') ||
      message.includes('すでに登録されています')
    ) {
      await showSiteDialog(
        'そのユーザー名は既に登録されています。',
        '新規登録できません'
      );
    } else if (lower.includes('captcha') || message.includes('セキュリティ確認')) {
      const authCode = e?.code ? `\nエラーコード: ${e.code}` : '';
      console.error('CAPTCHA認証エラー詳細:', {
        code: e?.code,
        message: e?.message,
        status: e?.status
      });
      await showSiteDialog(
        `セキュリティ確認に失敗しました。${authCode}\nCloudflareで成功表示でもこのエラーが続く場合は、Supabase側のCAPTCHA Secret Key設定を確認してください。`,
        'セキュリティ確認エラー'
      );
    } else {
      await showSiteDialog(
        mode === 'register'
          ? '新規登録に失敗しました。入力内容を確認して再度お試しください。'
          : 'ログインに失敗しました。ユーザー名またはパスワードを確認してください。',
        'エラー'
      );
      console.error(
        mode === 'register' ? '新規登録エラー:' : 'ログインエラー:',
        e
      );
    }

    // 失敗後は使い回さず、新しいTurnstileトークンを取得する。
    try { await resetAuthCaptcha(); } catch (captchaResetError) { console.error(captchaResetError); }
  } finally {
    button.disabled = false;
    if (!$('authScreen').classList.contains('hidden')) {
      button.textContent = defaultText;
    }
  }
});

$('authSwitch').addEventListener('click', () => { showAuth($('authSwitch').dataset.mode).catch(console.error); });

document.querySelectorAll('.p-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

$('domSearch').addEventListener('input', renderManage);
$('recordTypeFilter').addEventListener('change', renderManage);
$('recordClearRankFilter').addEventListener('change', renderManage);
$('recordFcFilter').addEventListener('change', renderManage);

$('viewAllManage').addEventListener('click', e => {
  const button = e.target.closest('[data-own-records-more]');
  if (!button) return;

  ownRegisteredBatch += 1;
  renderManage();
});

$('btnOpenLevelCorrection').addEventListener('click', () => {
  $('correctionLevel').value = selectedSong ? formatLevel(selectedSong.level) : '';
  $('levelCorrectionForm').classList.toggle('hidden');
});

$('btnSendLevelCorrection').addEventListener('click', async () => {
  const button = $('btnSendLevelCorrection');
  if (!selectedSong?.id) {
    await showSiteDialog('対象譜面を取得できません。', 'エラー');
    return;
  }

  const proposedLevel = $('correctionLevel').value;
  const numericProposedLevel = Number(proposedLevel);
  if (!proposedLevel || !Number.isFinite(numericProposedLevel) || numericProposedLevel <= 0 || numericProposedLevel > 9.99) {
    await showSiteDialog('難易度は0.01～9.99の範囲で入力してください。', '入力エラー');
    return;
  }

  const original = button.textContent;
  try {
    button.disabled = true;
    button.textContent = '送信中';
    await requestSongLevelCorrection({
      songId: selectedSong.id,
      proposedLevel,
      versionId: activeVersionId
    });
    hide('levelCorrectionForm');
    await showSiteDialog('難易度修正依頼を送信しました。', '送信完了');
  } catch (e) {
    await showSiteDialog(e.message || '難易度修正依頼の送信に失敗しました。', 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});
$('btnHeaderAdd').addEventListener('click', () => openScoreModal());
$('formTitle').addEventListener('input', scheduleSongSuggestions);

// IME変換確定時は待ち時間なしで最新候補を再取得する。
// iPhone/日本語入力で入力完了後に候補が追いつかないケースを減らす。
$('formTitle').addEventListener('compositionend', () => {
  clearTimeout(songSuggestTimer);
  suggestSongs();
});
$('partSelect').addEventListener('change', async () => {
  ++songSuggestRequestSeq;
  clearTimeout(songSuggestTimer);
  if ($('formTitle').value.trim()) await suggestSongs();
  await refreshSelectedPart();
});
$('formLevel').addEventListener('input', updateSkillPreview);
$('formRate').addEventListener('input', updateSkillPreview);
$('btnSubmitForm').addEventListener('click', async () => {
  const button = $('btnSubmitForm');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = '保存中';

    await submitScore();
  } catch (e) {
    await showSiteDialog(
      e?.message || '保存に失敗しました。',
      '保存エラー'
    );
  } finally {
    button.disabled = false;

    // モーダルがまだ開いている場合だけ元の表示へ戻す
    if ($('domModal').style.display !== 'none') {
      if (selectedSong) {
        button.textContent = '保存する';
      } else {
        button.textContent = originalText.includes('登録依頼')
          ? '登録依頼して保存'
          : '保存する';
      }
    }
  }
});
$('btnDeleteEditingScore').addEventListener('click', async () => {
  if (!editingScoreId) return;

  const ok = await showSiteConfirm(
    'この登録データを削除しますか？\nこの操作は元に戻せません。',
    '登録データの削除',
    '削除する'
  );
  if (!ok) return;

  const scoreId = editingScoreId;
  try {
    $('btnDeleteEditingScore').disabled = true;
    await deleteScore(scoreId);
    await recordMyActivity('EDIT');
    closeModal();
    await loadScores();
  } catch (e) {
    await showSiteDialog('削除に失敗しました: ' + e.message, 'エラー');
  } finally {
    $('btnDeleteEditingScore').disabled = false;
  }
});

$('btnCancelForm').addEventListener('click', closeModal);

$('btnCloseMypage').addEventListener('click', () => closeMyPage(true));

function detectSkillSyncGuideBrowser() {
  const ua = String(navigator.userAgent || '');
  const isMobileDevice = /(?:Android|iPhone|iPad|iPod)/.test(ua)
    || navigator.userAgentData?.mobile === true;
  const isChrome = isMobileDevice
    && /(?:Chrome\/|CriOS\/|Chromium\/)/.test(ua)
    && !/(?:EdgA?\/|EdgiOS\/|OPR\/|Opera\/)/.test(ua);
  if (isChrome) return 'chrome';

  const isSafari = /Safari\//.test(ua)
    && !/(?:Chrome\/|CriOS\/|Chromium\/|EdgA?\/|EdgiOS\/|OPR\/|FxiOS\/)/.test(ua);
  return isSafari ? 'safari' : 'other';
}

function getSkillSyncVisualGuideMarkup(browser) {
  const isSafari = browser === 'safari';
  const browserName = isSafari ? 'Safari' : 'Chrome';
  const browserMark = isSafari
    ? '<span class="sync-browser-mark safari" aria-hidden="true"></span>'
    : '<span class="sync-browser-mark chrome" aria-hidden="true"></span>';
  const bookmarkFigure = isSafari
    ? `
      <div class="sync-mini-browser safari" aria-hidden="true">
        <div class="sync-mini-address">gitadorafc.github.io</div>
        <div class="sync-mini-toolbar"><span>‹</span><strong class="sync-mini-toolbar-icon sync-mini-share-icon"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8h14v-8"/></svg></strong><span>▢</span></div>
        <div class="sync-mini-callout">共有 → ブックマークに追加</div>
      </div>`
    : `
      <div class="sync-mini-browser chrome" aria-hidden="true">
        <div class="sync-mini-address">gitadorafc.github.io <strong>︙</strong></div>
        <div class="sync-mini-menu"><span>新しいタブ</span><strong>☆ ブックマーク</strong></div>
      </div>`;
  const bookmarkHelp = isSafari
    ? '共有ボタンから「ブックマークに追加」を選択します。'
    : '︙メニューから「☆ ブックマーク」を選択します。';
  const runFigure = isSafari
    ? `
      <div class="sync-mini-browser sync-mini-run safari" aria-hidden="true">
        <div class="sync-mini-address">GITADORA公式サイト</div>
        <div class="sync-mini-toolbar"><span>‹</span><strong class="sync-mini-toolbar-icon sync-mini-book-icon"><svg viewBox="0 0 24 24"><path d="M3 5.5c3.2-.8 6-.1 9 2.1v11c-3-2.2-5.8-2.9-9-2.1v-11Zm18 0c-3.2-.8-6-.1-9 2.1v11c3-2.2 5.8-2.9 9-2.1v-11Z"/></svg></strong><span>▢</span></div>
        <div class="sync-mini-callout">同期用ブックマークを実行</div>
      </div>`
    : `
      <div class="sync-mini-browser sync-mini-run chrome" aria-hidden="true">
        <div class="sync-mini-search">同期用ブックマーク</div>
        <div class="sync-mini-suggestion"><strong><i class="sync-mini-globe"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5 7.5 8.2 5l2.2.8.8 2.4-1.7 1.6-2.8-.5L5 7.5Zm6.5 3 3-1.2 3.2 1.5.5 2.7-2.2 1.1-.8 3-2.1 1.1-1.4-2.8-2-.9.4-2.8 2.4-1.7Z"/></svg></i>同期用ブックマーク</strong><span>候補から選択</span></div>
      </div>`;
  const runHelp = isSafari
    ? '公式サイトを開いたまま、作成した同期用ブックマークを実行します。'
    : '公式サイトを開き、アドレスバーにブックマーク名を入力して、表示された候補を選択します。';

  return `
    <div class="sync-visual-device">${browserMark}<strong>${browserName}</strong></div>

    <div class="sync-visual-card">
      <span class="sync-visual-no">1</span>
      <div class="sync-mini-copy" aria-hidden="true"><span>SYNC CODE</span><strong>ABC1234</strong><i class="sync-mini-copy-icon"><svg viewBox="0 0 24 24"><rect x="8" y="7" width="11" height="13" rx="1.5"/><path d="M16 7V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v11A1.5 1.5 0 0 0 5.5 18H8"/></svg></i></div>
      <div class="sync-visual-content">
        <strong>同期コードをコピー</strong>
        <button type="button" class="sync-visual-primary" data-sync-guide-action="copy">コードをコピー</button>
      </div>
    </div>

    <div class="sync-visual-card">
      <span class="sync-visual-no">2</span>
      ${bookmarkFigure}
      <div class="sync-visual-content">
        <strong>このページをブックマーク</strong>
        <p>${bookmarkHelp}</p>
      </div>
    </div>

    <div class="sync-visual-card">
      <span class="sync-visual-no">3</span>
      <div class="sync-mini-edit" aria-hidden="true">
        <b>ブックマークを編集</b>
        <span>同期用ブックマーク</span>
        <strong>javascript:…</strong>
      </div>
      <div class="sync-visual-content">
        <strong>ブックマークを編集</strong>
        <p class="sync-bookmark-name">同期用ブックマーク<br><small>（お好きな名前で自由に設定してください）</small></p>
        <p>URLを全削除し、コピーしたコードを貼り付けます。</p>
      </div>
    </div>

    <div class="sync-visual-card sync-visual-run-card">
      <span class="sync-visual-no">4</span>
      ${runFigure}
      <div class="sync-visual-content">
        <strong>同期する</strong>
        <button type="button" class="sync-visual-primary" data-sync-guide-action="open">GITADORA公式サイトを開く</button>
        <p>${runHelp}</p>
      </div>
    </div>

    <div class="skill-sync-card-warning">
      ⚠ 複数カードがある場合、参照するカードが合っているかご確認ください。
    </div>`;
}

function renderSkillSyncBrowserGuide() {
  const guide = $('skillSyncBrowserGuide');
  const legacyGuide = $('skillSyncLegacyGuide');
  const visualGuide = $('skillSyncVisualGuide');
  if (!guide || !legacyGuide || !visualGuide) return;

  // ブラウザ別の図解を全ユーザーへ表示する。PC版Chromeは従来表示を使用。
  const detectedBrowser = detectSkillSyncGuideBrowser();
  const browser = detectedBrowser;
  const useVisualGuide = browser === 'safari' || browser === 'chrome';
  legacyGuide.classList.toggle('hidden', useVisualGuide);
  visualGuide.classList.toggle('hidden', !useVisualGuide);
  $('skillSyncLegacyChromeNote')?.classList.toggle(
    'hidden',
    detectedBrowser === 'other'
  );

  if (useVisualGuide) {
    visualGuide.innerHTML = getSkillSyncVisualGuideMarkup(browser);
    return;
  }

  guide.innerHTML =
    '1. 何でもいいので適当にブックマークを作ります。<br>' +
    '2. 「コードをコピー」を押し、1で作成したブックマークのURLの欄に貼り付けます。ブックマークの名前は分かりやすいように好きな文字でOKです👌';
}

function openSkillSyncDialog() {
  closeMenu();
  renderSkillSyncBrowserGuide();
  setSkillSyncStatus('待機中');
  $('skillSyncMask').style.display = 'flex';
  const dialog = document.querySelector('.skill-sync-dialog');
  if (dialog) dialog.scrollTop = 0;
}

function closeSkillSyncDialog(returnToMenu = false) {
  if (skillSyncInProgress) return;
  $('skillSyncMask').style.display = 'none';
  if (returnToMenu) openMenu();
}

$('btnCloseSkillSync').addEventListener('click', () => {
  closeSkillSyncDialog(true);
});

$('skillSyncMask').addEventListener('click', e => {
  if (e.target === $('skillSyncMask') && !skillSyncInProgress) {
    $('skillSyncMask').style.display = 'none';
  }
});

async function copySkillSyncCode() {
  try {
    // Android Chromeでは <a>.href を通すと、コード中の ' が %27 に変換される場合がある。
    // ブックマークレットはURL正規化せず、生のJavaScript文字列をそのままコピーする。
    const bookmarklet = buildSkillSyncBookmarklet();

    await navigator.clipboard.writeText(bookmarklet);
    setSkillSyncStatus('同期用コードをコピーしました。ブックマークのURL欄へ貼り付けてください。', 'success');
  } catch (e) {
    setSkillSyncStatus('コードのコピーに失敗しました。ブラウザのクリップボード権限を確認してください。', 'error');
  }
}

function openEamusementForSkillSync() {
  const popup = window.open(getEamusementSyncEntry(), '_blank');
  if (!popup) {
    setSkillSyncStatus('ポップアップがブロックされました。ブラウザのポップアップ許可を確認してください。', 'error');
    return;
  }
  setSkillSyncStatus('e-amusementを開きました。ログイン状態を確認後、コードを設定した同期用ブックマークを実行してください。', 'running');
}

$('btnCopySkillSync').addEventListener('click', copySkillSyncCode);
$('btnOpenEamusement').addEventListener('click', openEamusementForSkillSync);

$('skillSyncVisualGuide').addEventListener('click', event => {
  const button = event.target.closest('[data-sync-guide-action]');
  if (!button) return;

  const action = button.dataset.syncGuideAction;
  if (action === 'copy') {
    copySkillSyncCode();
    return;
  }
  if (action === 'open') {
    openEamusementForSkillSync();
  }
});

window.addEventListener('message', async event => {
  if (event.origin !== EAMUSEMENT_ORIGIN) return;
  if (event.data?.type !== 'GITADORA_SKILL_SYNC') return;
  await importSkillSyncRecords(event.data);
});

$('btnDeleteAccount').addEventListener('click', deleteOwnAccount);
$('btnChangeUsername').addEventListener('click', async () => {
  const button = $('btnChangeUsername');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = '変更中';

    await changeOwnUsername();
  } catch (e) {
    const message = e?.message || String(e);

    if (
      message.includes('既に登録されています') ||
      message.includes('すでに使用されています') ||
      message.includes('already') ||
      message.includes('duplicate')
    ) {
      await showSiteDialog(
        'そのユーザー名は既に登録されています。',
        'ユーザー名を変更できません'
      );
    } else {
      await showSiteDialog('ユーザー名の変更に失敗しました。', 'エラー');
      console.error('ユーザー名変更エラー:', e);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

$('btnLogout').addEventListener('click', async () => {
  try {
    closeMyPage();
    scores = [];
    editingScoreId = null;
    selectedSong = null;
    await logout();
  } catch (e) {
    await showSiteDialog(e?.message || 'ログアウトに失敗しました。', 'エラー');
  }
});

$('btnChangePassword').addEventListener('click', async () => {
  const button = $('btnChangePassword');
  const originalText = button.textContent;

  try {
    const password = $('newPassword').value;

    if (password.length < 8) {
      throw new Error('パスワードは8文字以上で入力してください。');
    }

    button.disabled = true;
    button.textContent = '変更中';

    await changePassword(password);
    $('newPassword').value = '';

    await showSiteDialog('パスワードを変更しました。', '変更完了');
  } catch (e) {
    await showSiteDialog(e.message || 'パスワード変更に失敗しました。', 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

$('btnMenuFeedback').addEventListener('click', openFeedback);
$('menuOfuseSupport')?.addEventListener('click', () => {
  closeMenu();
  $('supportMask').style.display = 'flex';
  requestAnimationFrame(syncGlobalModalScrollLock);
});
$('btnCloseSupport')?.addEventListener('click', () => {
  $('supportMask').style.display = 'none';
  openMenu();
  requestAnimationFrame(syncGlobalModalScrollLock);
});

$('btnCloseFeedback').addEventListener('click', () => closeFeedback(true));
$('feedbackMask').addEventListener('click', e => {
  if (e.target === $('feedbackMask')) closeFeedback();
});
$('btnSubmitFeedback').addEventListener('click', submitFeedback);

$('btnAdmin').addEventListener('click', openAdmin);
$('btnAdminBulkDeleteScores')?.addEventListener('click', adminBulkDeleteCurrentScores);
$('btnCloseAdmin').addEventListener('click', closeAdmin);

document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab));
});

let adminSongSearchTimer = null;
$('adminSongSearch').addEventListener('input', () => {
  clearTimeout(adminSongSearchTimer);
  adminSongPage = 0;
  adminSongSearchTimer = setTimeout(loadAdminSongs,250);
});
['adminSongTypeFilter', 'adminSongReadingFilter'].forEach(id => {
  $(id)?.addEventListener('change', () => {
    adminSongPage = 0;
    loadAdminSongs();
  });
});
let adminRequestSearchTimer = null;
$('adminRequestSearch').addEventListener('input', () => {
  clearTimeout(adminRequestSearchTimer);
  adminRequestSearchTimer = setTimeout(loadAdminRequests,250);
});
let adminUserSearchTimer = null;
$('adminUserSearch').addEventListener('input', () => {
  clearTimeout(adminUserSearchTimer);
  adminUserSearchTimer = setTimeout(loadAdminUsers,250);
});
$('adminUserSortKey')?.addEventListener('change', event => {
  const allowedKeys = new Set([
    'username', 'activity_level', 'last_open_at', 'last_update_at',
    'last_sign_in_at', 'created_at'
  ]);
  adminUserSort.key = allowedKeys.has(event.target.value)
    ? event.target.value
    : 'created_at';
  loadAdminUsers();
});
$('adminUserSortDir')?.addEventListener('change', event => {
  adminUserSort.dir = event.target.value === 'asc' ? 'asc' : 'desc';
  loadAdminUsers();
});

$('adminBody')?.addEventListener('input', event => {
  const readingInput = event.target.closest('[data-master-reading]');
  if (!readingInput) return;
  const reviewed = readingInput.closest('tr')
    ?.querySelector('[data-master-reading-reviewed]');
  if (reviewed) reviewed.checked = Boolean(readingInput.value.trim());
});

$('btnAdminAddSong').addEventListener('click', async () => {
  adminNewSongRowVisible = true;
  adminSongPage = 0;
  $('adminSongSearch').value = '';
  await loadAdminSongs();
  const titleInput = $('adminBody').querySelector('[data-master-new-row] [data-master-title]');
  titleInput?.focus();
});
$('btnAdminCsvDownload')?.addEventListener('click', downloadAdminMasterCsv);
$('btnAdminCsvUpload')?.addEventListener('click', openAdminCsvUpload);
$('adminCsvVersion')?.addEventListener('change', toggleAdminCsvNewVersionFields);
$('btnAdminCsvCancel')?.addEventListener('click', closeAdminCsvUpload);
$('adminCsvMask')?.addEventListener('click', event => {
  if (event.target === $('adminCsvMask')) closeAdminCsvUpload();
});
$('adminCsvFile')?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) {
    $('adminCsvStatus').textContent = '';
    return;
  }
  try {
    const rows = parseMasterCsv(await file.text());
    const updates = rows.filter(row => row.songId).length;
    const additions = rows.length - updates;
    $('adminCsvStatus').textContent = `${rows.length}曲（更新${updates}・新規${additions}）`;
  } catch (error) {
    $('adminCsvStatus').textContent = error.message;
  }
});
$('btnAdminCsvImport')?.addEventListener('click', async () => {
  const button = $('btnAdminCsvImport');
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = '処理中...';
    await importAdminMasterCsv();
  } catch (error) {
    await showSiteDialog('CSVの取込に失敗しました: ' + error.message, 'エラー');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
$('btnAdminSaveAllSongs')?.addEventListener('click', async () => {
  const button = $('btnAdminSaveAllSongs');
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = '保存中...';
    const savedCount = await saveVisibleMasterSongs();
    await showSiteDialog(
      `表示中の${savedCount}曲をまとめて保存しました。`,
      '保存完了'
    );
  } catch (error) {
    await showSiteDialog(
      '曲マスターの一括保存に失敗しました: ' + error.message,
      'エラー'
    );
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
$('adminSongInitialFilter')?.addEventListener('change', () => {
  renderAdminSongPickerCandidates();
});
$('adminSongCandidate')?.addEventListener('change', async event => {
  const title = event.target.value;
  if (!title) return;
  await selectSongTitle(title);
});
$('btnAdminCancelSong').addEventListener('click', closeAdminSongForm);
$('btnAdminSaveSong').addEventListener('click', async () => {
  try {
    $('btnAdminSaveSong').disabled = true;
    await submitAdminSong();
  } catch (e) {
    await showSiteDialog('保存に失敗しました: ' + e.message, 'エラー');
  } finally {
    $('btnAdminSaveSong').disabled = false;
  }
});

$('btnAdminPasswordCancel').addEventListener('click', closeAdminPassword);
$('btnAdminPasswordSave').addEventListener('click', async () => {
  try {
    $('btnAdminPasswordSave').disabled = true;
    await submitAdminPassword();
  } catch (e) {
    await showSiteDialog('変更に失敗しました: ' + e.message, 'エラー');
  } finally {
    $('btnAdminPasswordSave').disabled = false;
  }
});


let userSearchTimer = null;
$('userSearch').addEventListener('input', () => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(() => loadUsers({ resetPage: true }), 250);
});

$('userListSortKey')?.addEventListener('change', event => {
  userListSort.key = event.target.value;
  userListPage = 0;
  renderUsers();
});
$('userListSortDirection')?.addEventListener('change', event => {
  userListSort.dir = event.target.value;
  userListPage = 0;
  renderUsers();
});
$('userListPager')?.addEventListener('click', e => {
  const navButton = e.target.closest('[data-user-page]');

  if (navButton && !navButton.disabled) {
    if (navButton.dataset.userPage === 'prev' && userListPage > 0) {
      userListPage--;
    } else if (navButton.dataset.userPage === 'next') {
      const totalPages = Math.max(1, Math.ceil(publicUsers.length / USER_LIST_PAGE_SIZE));
      if (userListPage + 1 >= totalPages) return;
      userListPage++;
    } else {
      return;
    }
  } else {
    return;
  }

  renderUsers();
  requestAnimationFrame(scrollUserListPageToTop);
});

$('userListPager')?.addEventListener('change', e => {
  const select = e.target.closest('[data-user-page-select]');
  if (!select) return;

  const nextPage = Number(select.value);
  const totalPages = Math.max(1, Math.ceil(publicUsers.length / USER_LIST_PAGE_SIZE));
  if (!Number.isInteger(nextPage) || nextPage < 0 || nextPage >= totalPages) return;

  userListPage = nextPage;
  renderUsers();
  requestAnimationFrame(scrollUserListPageToTop);
});

$('versionSelect').addEventListener('change', async e => { await switchGameVersion(e.target.value); });

$('btnCloseUserDetail').addEventListener('click', closeUserDetail);
$('userDetailTabs').addEventListener('click', async e => {
  const button = e.target.closest('[data-user-detail-tab]');
  if (!button) return;

  const tab = button.dataset.userDetailTab;
  setUserDetailTab(tab);

  if (tab === 'records' && !viewedUserRegisteredScores.length) {
    await loadViewedUserRegisteredScores();
  }
});

$('userDetailRecords').addEventListener('click', e => {
  const button = e.target.closest('[data-user-detail-records-more]');
  if (!button) return;

  viewedUserRegisteredBatch += 1;
  renderViewedUserRegisteredScores();
});

$('btnCloseRateCompare').addEventListener('click', closeRateComparison);
$('btnEditRateCompare')?.addEventListener('click', async () => {
  const score = scores.find(row => String(row.score_id) === String(rateComparisonEditScoreId));
  if (!score) {
    await showSiteDialog('編集する登録データを取得できませんでした。', 'エラー');
    return;
  }

  closeRateComparison();
  openScoreModal(score);
});
$('rateCompareMask').addEventListener('click', e => {
  if (e.target === $('rateCompareMask')) closeRateComparison();
});

document.addEventListener('click', async e => {
  const adminFeedbackReply = e.target.closest('[data-admin-feedback-reply]');
  if (adminFeedbackReply) {
    const id = adminFeedbackReply.dataset.adminFeedbackReply;
    const input = document.querySelector(`[data-admin-feedback-reply-input="${id}"]`);
    const reply = input?.value || '';

    try {
      if (!reply.trim()) {
        await showSiteDialog('返信内容を入力してください。', '入力エラー');
        return;
      }

      const ok = await showSiteConfirm(
        'この内容で返信しますか？\n返信は1回のみで、送信後の変更・追加返信はできません。',
        '返信確認',
        '返信する'
      );
      if (!ok) return;

      adminFeedbackReply.disabled = true;
      await replyAdminFeedbackOnce(id, reply);
      await showSiteDialog('返信しました。', '返信完了');
    } catch (error) {
      await showSiteDialog(error?.message || '返信に失敗しました。', 'エラー');
      if (adminFeedbackReply.isConnected) adminFeedbackReply.disabled = false;
    }
    return;
  }

  const adminFeedbackDelete = e.target.closest('[data-admin-feedback-delete]');
  if (adminFeedbackDelete) {
    try {
      adminFeedbackDelete.disabled = true;
      await deleteAdminFeedback(adminFeedbackDelete.dataset.adminFeedbackDelete);
    } catch (error) {
      await showSiteDialog(error?.message || '削除に失敗しました。', 'エラー');
    } finally {
      // キャンセル時は一覧を再描画しないため、押したボタンが残る。
      // その場合も必ず再度押せる状態へ戻す。
      if (adminFeedbackDelete.isConnected) {
        adminFeedbackDelete.disabled = false;
      }
    }
    return;
  }

  const adminFeedbackStatus = e.target.closest('[data-admin-feedback-status]');
  if (adminFeedbackStatus) {
    try {
      adminFeedbackStatus.disabled = true;
      await updateAdminFeedbackStatus(
        adminFeedbackStatus.dataset.adminFeedbackStatus,
        adminFeedbackStatus.dataset.feedbackNextStatus
      );
    } catch (error) {
      await showSiteDialog(error?.message || '更新に失敗しました。', 'エラー');
      adminFeedbackStatus.disabled = false;
    }
    return;
  }

  const suggestion = e.target.closest('.suggestion');
  const instrumentButton = e.target.closest('[data-instrument]');
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');
  const adminEditSong = e.target.closest('[data-admin-edit-song]');
  const adminDeleteSong = e.target.closest('[data-admin-delete-song]');
  const adminDeleteUser = e.target.closest('[data-admin-delete-user]');
  const adminResetUser = e.target.closest('[data-admin-reset-user]');
  const adminApproveRequest = e.target.closest('[data-admin-approve-request]');
  const adminHotRequest = e.target.closest('[data-admin-hot-request]');
  const adminRejectRequest = e.target.closest('[data-admin-reject-request]');
  const userOpen = e.target.closest('[data-user-open]');
  const favoriteToggle = e.target.closest('[data-favorite-user]');
  const favoriteOpen = e.target.closest('[data-favorite-open]');
  const favoriteRemove = e.target.closest('[data-favorite-remove]');
  const compareCard = e.target.closest('[data-compare-song]');
  const adminRegisterMasterRow = e.target.closest('[data-admin-register-master-row]');
  const adminCancelMasterRow = e.target.closest('[data-admin-cancel-master-row]');
  const adminSaveMasterRow = e.target.closest('[data-admin-save-master-row]');
  const adminDeleteMasterRow = e.target.closest('[data-admin-delete-master-row]');

  if (instrumentButton) { await switchInstrument(instrumentButton.dataset.instrument); return; }

  if (favoriteToggle) {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavorite(favoriteToggle.dataset.favoriteUser, favoriteToggle.dataset.favoriteInstrument || activeInstrument);
    return;
  }

  if (userOpen && !favoriteToggle) {
    await openUserDetail(userOpen.dataset.userOpen, userOpen.dataset.userName);
    return;
  }
  if (favoriteOpen) {
    await openFavoriteUserDetail(
      favoriteOpen.dataset.favoriteOpen,
      favoriteOpen.dataset.favoriteName,
      favoriteOpen.dataset.favoriteViewInstrument || activeInstrument
    );
    return;
  }

  if (favoriteRemove) {
    await removeFavorite(
      favoriteRemove.dataset.favoriteRemove,
      favoriteRemove.dataset.favoriteInstrument || 'GF'
    );
    await Promise.all([loadFavorites(), loadUsers()]);
    return;
  }

  if (suggestion) {
    if (suggestion.dataset.requestTitle) {
      $('formTitle').value = suggestion.dataset.requestTitle;
      $('songSuggestions').innerHTML = '';
      await refreshSelectedPart();
    } else {
      await selectSongTitle(suggestion.dataset.title);
    }
  }

  if (compareCard && !edit && !del) {
    await openRateComparison(
      compareCard.dataset.compareSong,
      compareCard.dataset.compareTitle,
      compareCard.dataset.comparePart,
      compareCard.dataset.compareEditScore || null
    );
    return;
  }

  if (edit) {
    const score = scores.find(s => s.score_id === edit.dataset.edit);
    if (score) openScoreModal(score);
  }

  if (del) {
    const ok = await showSiteConfirm(
      'この登録データを削除しますか？\nこの操作は元に戻せません。',
      '登録データの削除',
      '削除する'
    );
    if (!ok) return;

    try {
      await deleteScore(del.dataset.delete);
      await recordMyActivity('EDIT');
      await loadScores();
    } catch (e) {
      await showSiteDialog('削除に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminRegisterMasterRow) {
    const tr = adminRegisterMasterRow.closest('tr[data-master-new-row]');
    if (!tr) return;

    try {
      adminRegisterMasterRow.disabled = true;
      await saveMasterSongRow(collectMasterSongRow(tr));
      adminSongPickerKey = '';
      adminSongPickerChoices = [];
      adminNewSongRowVisible = false;
      await loadAdminSongs();
      await showSiteDialog('新規曲を登録しました。', '登録完了');
    } catch (e) {
      await showSiteDialog('新規曲の登録に失敗しました: ' + e.message, 'エラー');
    } finally {
      if (adminRegisterMasterRow.isConnected) {
        adminRegisterMasterRow.disabled = false;
      }
    }
    return;
  }

  if (adminCancelMasterRow) {
    adminNewSongRowVisible = false;
    await loadAdminSongs();
    return;
  }

  if (adminSaveMasterRow) {
    const tr = adminSaveMasterRow.closest('tr[data-master-row]');
    if (!tr) return;

    try {
      adminSaveMasterRow.disabled = true;
      await saveMasterSongRow(collectMasterSongRow(tr));
      adminSongPickerKey = '';
      adminSongPickerChoices = [];
      await loadAdminSongs();
    } catch (e) {
      await showSiteDialog('曲マスター保存に失敗しました: ' + e.message, 'エラー');
    } finally {
      adminSaveMasterRow.disabled = false;
    }
  }

  if (adminDeleteMasterRow) {
    const tr = adminDeleteMasterRow.closest('tr[data-master-row]');
    if (!tr) return;
    const title = tr.dataset.originalTitle;
    if (!await showSiteConfirm(
      `「${title}」の全パートを曲マスターから削除しますか？\n登録済みユーザー記録も影響を受けるため注意してください。`,
      '曲マスター削除',
      '削除する'
    )) return;

    try {
      await deleteMasterSongTitle(title);
      await loadAdminSongs();
    } catch (e) {
      await showSiteDialog('曲マスター削除に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminEditSong) {
    const song = adminSongs.find(s => s.id === adminEditSong.dataset.adminEditSong);
    if (song) openAdminSongForm(song);
  }

  if (adminDeleteSong) {
    const song = adminSongs.find(s => s.id === adminDeleteSong.dataset.adminDeleteSong);
    if (!song) return;
    if (!await showSiteConfirm(
      `「${song.title} / ${song.part}」を曲マスターから削除しますか？\nこの譜面を登録しているユーザーの記録も削除されます。`,
      '曲マスター削除',
      '削除する'
    )) return;
    try {
      await deleteMasterSong(song.id);
      await loadAdminSongs();
    } catch (e) {
      await showSiteDialog('削除に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminApproveRequest) {
    try {
      const requestId = adminApproveRequest.dataset.adminApproveRequest;
      const req = adminRequests.find(r => r.id === requestId);
      const level = $(`requestLevel_${requestId}`).value;
      const title = req?.request_type === 'level_correction'
        ? req.title
        : ($(`requestTitle_${requestId}`)?.value || '').trim();
      const part = req?.request_type === 'level_correction'
        ? req.part
        : ($(`requestPart_${requestId}`)?.value || '');

      const numericLevel = Number(level);
      if (!title) throw new Error('承認する曲名を入力してください。');
      if (!PARTS.includes(part)) throw new Error('承認するパートを選択してください。');
      if (!Number.isFinite(numericLevel) || numericLevel <= 0 || numericLevel > 9.99) {
        throw new Error('難易度は0.01～9.99の範囲で入力してください。');
      }

      const changes = [];
      if (req && title !== req.title) changes.push(`曲名を「${req.title}」から「${title}」へ`);
      if (req && part !== req.part) changes.push(`パートを「${req.part}」から「${part}」へ`);
      const confirmText = changes.length
        ? `${changes.join('、')}修正して、OTHERとして承認しますか？`
        : 'この登録依頼をOTHERとして承認しますか？';
      if (!await showSiteConfirm(confirmText, '登録依頼の承認', '承認する')) return;

      if (req?.request_type === 'level_correction') {
        await approveSongRequest(requestId, level, false);
      } else {
        await approveEditedNewSongRequest(requestId, req, title, part, numericLevel, false);
      }
      await loadAdminRequests();
    } catch (e) {
      await showSiteDialog('承認に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminHotRequest) {
    try {
      const requestId = adminHotRequest.dataset.adminHotRequest;
      const req = adminRequests.find(r => r.id === requestId);
      const level = $(`requestLevel_${requestId}`).value;
      const title = req?.request_type === 'level_correction'
        ? req.title
        : ($(`requestTitle_${requestId}`)?.value || '').trim();
      const part = req?.request_type === 'level_correction'
        ? req.part
        : ($(`requestPart_${requestId}`)?.value || '');

      const numericLevel = Number(level);
      if (!title) throw new Error('承認する曲名を入力してください。');
      if (!PARTS.includes(part)) throw new Error('承認するパートを選択してください。');
      if (!Number.isFinite(numericLevel) || numericLevel <= 0 || numericLevel > 9.99) {
        throw new Error('難易度は0.01～9.99の範囲で入力してください。');
      }

      const changes = [];
      if (req && title !== req.title) changes.push(`曲名を「${req.title}」から「${title}」へ`);
      if (req && part !== req.part) changes.push(`パートを「${req.part}」から「${part}」へ`);
      const confirmText = changes.length
        ? `${changes.join('、')}修正して、HOT曲として承認しますか？`
        : 'この登録依頼をHOT曲として承認しますか？';
      if (!await showSiteConfirm(confirmText, 'HOT承認', '承認する')) return;

      if (req?.request_type === 'level_correction') {
        await approveSongRequest(requestId, level, true);
      } else {
        await approveEditedNewSongRequest(requestId, req, title, part, numericLevel, true);
      }
      await loadAdminRequests();
    } catch (e) {
      await showSiteDialog('HOT承認に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminRejectRequest) {
    if (!await showSiteConfirm('この登録依頼を却下しますか？', '登録依頼の却下', '却下する')) return;
    try {
      await rejectSongRequest(adminRejectRequest.dataset.adminRejectRequest);
      await loadAdminRequests();
    } catch (e) {
      await showSiteDialog('却下に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminDeleteUser) {
    const user = adminUsers.find(u => u.id === adminDeleteUser.dataset.adminDeleteUser);
    if (!user) return;
    if (!await showSiteConfirm(
      `ユーザー「${user.username}」を削除しますか？\n登録スコアも削除され、元に戻せません。`,
      'ユーザー削除',
      '削除する'
    )) return;
    try {
      await accountAdmin('delete_user', { target_user_id: user.id });
      await loadAdminUsers();
    } catch (e) {
      await showSiteDialog('ユーザー削除に失敗しました: ' + e.message, 'エラー');
    }
  }

  if (adminResetUser) {
    openAdminPassword(adminResetUser.dataset.adminResetUser);
  }
});



$('btnIntroLogin').addEventListener('click', () => { showAuth('login').catch(console.error); });
$('btnIntroRegister').addEventListener('click', () => { showAuth('register').catch(console.error); });
$('btnMenu').addEventListener('click', openMenu);
$('btnRefreshApp').addEventListener('click', () => window.location.reload());
$('btnCloseMenu').addEventListener('click', closeMenu);
$('menuMask').addEventListener('click', e => { if (e.target === $('menuMask')) closeMenu(); });
$('btnMenuMypage').addEventListener('click', async () => { closeMenu(); await openMyPage(true); });
$('btnMenuFeatureSettings').addEventListener('click', openFeatureSettings);
$('btnCloseFeatureSettings').addEventListener('click', () => closeFeatureSettings(true));
$('featureSettingsMask').addEventListener('click', e => {
  if (e.target === $('featureSettingsMask')) closeFeatureSettings();
});
$('btnSaveFeatureSettings').addEventListener('click', saveFeatureSettings);
$('settingLightMode').addEventListener('change', e => {
  applyLightMode(e.target.checked);
});
$('btnSaveXId').addEventListener('click', saveMyXId);
$('btnMypageUserSwitch')?.addEventListener('click', openAccountSwitch);
$('btnCloseAccountSwitch')?.addEventListener('click', () => closeAccountSwitch(true));
$('accountSwitchMask')?.addEventListener('click', event => {
  if (event.target === $('accountSwitchMask')) closeAccountSwitch(true);
});
$('btnAddSwitchAccount')?.addEventListener('click', addAdminSwitchAccount);
$('accountSwitchList')?.addEventListener('click', async event => {
  const switchButton = event.target.closest('[data-switch-admin-account]');
  const removeButton = event.target.closest('[data-remove-admin-account]');

  if (switchButton && !switchButton.disabled) {
    try {
      switchButton.disabled = true;
      switchButton.textContent = '切り替え中...';
      await activateStoredAdminAccount(switchButton.dataset.switchAdminAccount);
    } catch (error) {
      $('accountSwitchStatus').textContent = error?.message || 'ユーザーを切り替えられませんでした。';
      renderAccountSwitchList();
    }
    return;
  }

  if (removeButton) {
    const account = readStoredAdminAccounts().find(
      item => item.userId === removeButton.dataset.removeAdminAccount
    );
    const confirmed = await showSiteConfirm(
      `保存済みのユーザー「${account?.username || ''}」を切り替え一覧から削除しますか？\nアカウント本体や登録データは削除されません。`,
      '保存済みユーザーの削除',
      '削除する'
    );
    if (!confirmed) return;
    writeStoredAdminAccounts(
      readStoredAdminAccounts().filter(
        account => account.userId !== removeButton.dataset.removeAdminAccount
      )
    );
    renderAccountSwitchList();
  }
});

$('btnMenuSkillSync').addEventListener('click', openSkillSyncDialog);
$('btnMenuShareSkill').addEventListener('click', openSkillShareDialog);
$('btnMenuSkillShareHistory').addEventListener('click', openSkillHistory);
$('btnCloseSkillShare').addEventListener('click', () => closeSkillShareDialog(true));
$('skillShareMask').addEventListener('click', event => {
  if (event.target === $('skillShareMask')) closeSkillShareDialog();
});
document.querySelectorAll('[data-skill-share-selection]').forEach(button => {
  button.addEventListener('click', () => updateSkillShareSelection(button.dataset.skillShareSelection));
});
$('btnExecuteSkillShare').addEventListener('click', executeSkillShare);
$('btnMenuSkillHistory').addEventListener('click', openSkillHistory);
$('btnCloseSkillHistory').addEventListener('click', () => {
  if (!$('skillHistoryPreviewView').classList.contains('hidden')) {
    showSkillHistoryListView();
    $('skillHistoryStatus').textContent = `${skillHistoryInstrument}の履歴 ${skillHistoryRows.length}件`;
    return;
  }
  closeSkillHistory(true);
});
$('skillHistoryMask').addEventListener('click', event => {
  if (event.target === $('skillHistoryMask')) closeSkillHistory();
});
document.querySelectorAll('[data-skill-history-instrument]').forEach(button => {
  button.addEventListener('click', () => {
    updateSkillHistoryInstrument(button.dataset.skillHistoryInstrument, true);
  });
});
document.querySelectorAll('[data-skill-unified-selection]').forEach(button => {
  button.addEventListener('click', () => {
    updateUnifiedSkillSelection(button.dataset.skillUnifiedSelection, true);
  });
});
$('btnSaveSkillHistory').addEventListener('click', () => saveCurrentSkillHistory().catch(console.error));
$('btnUnifiedSkillShare').addEventListener('click', () => executeUnifiedSkillAction('share'));
$('btnUnifiedSkillSave').addEventListener('click', () => executeUnifiedSkillAction('save'));
$('btnUnifiedSkillSaveShare').addEventListener('click', () => executeUnifiedSkillAction('save-share'));
$('btnLoadMoreSkillHistory').addEventListener('click', () => loadSkillHistory(false));
$('btnShareSkillHistory').addEventListener('click', shareSkillHistoryPreview);
$('skillHistoryList').addEventListener('click', event => {
  const openButton = event.target.closest('[data-open-skill-history]');
  const compareButton = event.target.closest('[data-compare-skill-history]');
  const deleteButton = event.target.closest('[data-delete-skill-history]');
  if (deleteButton) {
    deleteSkillHistory(deleteButton.dataset.deleteSkillHistory).catch(console.error);
    return;
  }
  if (compareButton) {
    openSkillHistoryComparison(compareButton.dataset.compareSkillHistory).catch(console.error);
    return;
  }
  if (openButton) {
    openSkillHistoryPreview(openButton.dataset.openSkillHistory).catch(console.error);
  }
});
$('btnMenuSkillRanking').addEventListener('click', openSkillTargetRanking);
$('btnCloseSkillRanking').addEventListener('click', () => closeSkillTargetRanking(true));
$('skillRankingMask').addEventListener('click', e => {
  if (e.target === $('skillRankingMask')) closeSkillTargetRanking();
});
$('skillRankingMin').addEventListener('change', () => {
  keepSkillRankingRangeValid('min');
  scrollSkillRankingToTop();
});
$('skillRankingMax').addEventListener('change', () => {
  keepSkillRankingRangeValid('max');
  scrollSkillRankingToTop();
});
$('btnLoadSkillRanking').addEventListener('click', loadSkillTargetRanking);
$('skillRankingSort').addEventListener('change', event => {
  skillRankingState.sort = event.target.value;
  scrollSkillRankingToTop();
  renderSkillTargetRanking();
});
document.querySelectorAll('.skill-ranking-tab').forEach(button => {
  button.addEventListener('click', () => {
    skillRankingState.category = button.dataset.rankingCategory;
    scrollSkillRankingToTop();
    renderSkillTargetRanking();
  });
});
$('btnMenuRivals').addEventListener('click', openRivalManage);
$('btnMenuHowTo').addEventListener('click', openHowTo);
$('btnCloseHowTo').addEventListener('click', () => closeHowTo(true));
$('howToMask').addEventListener('click', e => { if (e.target === $('howToMask')) closeHowTo(); });
$('btnCloseRivalManage').addEventListener('click', () => closeRivalManage(true));
$('rivalManageMask').addEventListener('click', e => { if (e.target === $('rivalManageMask')) closeRivalManage(); });

$('siteDialogOk').addEventListener('click', () => closeSiteDialog(true));
$('siteDialogInput').addEventListener('keydown', e => { if (e.key === 'Enter') closeSiteDialog(true); });
$('siteDialogCancel').addEventListener('click', () => closeSiteDialog(false));
$('siteDialogMask').addEventListener('click', e => {
  if (e.target === $('siteDialogMask')) closeSiteDialog(siteDialogConfirmMode ? false : true);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !$('appScreen').classList.contains('hidden')) {
    loadScores().catch(console.error);
  }
});

window.addEventListener('focus', () => {
  if (!$('appScreen').classList.contains('hidden')) {
    loadScores().catch(console.error);
  }
});

// モーダル表示中は背面のメイン画面をスクロールさせない。
// style/classの切替を監視するため、登録曲詳細・マイページ・エラー等にも共通適用。
const modalScrollObserver = new MutationObserver(() => {
  requestAnimationFrame(syncGlobalModalScrollLock);
});

GLOBAL_SCROLL_LOCK_OVERLAYS.forEach(selector => {
  const element = document.querySelector(selector);
  if (element) {
    modalScrollObserver.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }
});
requestAnimationFrame(syncGlobalModalScrollLock);

// ヘッダーの実際の高さを使ってユーザーリスト固定位置を決める。
window.addEventListener('resize', () => {
  syncAppStickyHeaderHeight();
  syncRegisteredEditButtonWidths();
});
window.addEventListener('orientationchange', () => setTimeout(syncAppStickyHeaderHeight, 80));

const appHeaderResizeObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(() => syncAppStickyHeaderHeight())
  : null;
const appStickyHeader = document.querySelector('.p-header');
if (appStickyHeader && appHeaderResizeObserver) {
  appHeaderResizeObserver.observe(appStickyHeader);
}

[
  document.querySelector('#appScreen > .p-container'),
  $('userDetailSkill'),
  $('userDetailRecords'),
  $('adminBody')
].filter(Boolean).forEach(scroller => {
  scroller.addEventListener('scroll', markAppScrolling, { passive:true });
});
requestAnimationFrame(syncAppStickyHeaderHeight);

applyLightMode();

init().catch(err => {
  console.error(err);
  showSiteDialog('初期化に失敗しました: ' + err.message, '初期化エラー');
});
