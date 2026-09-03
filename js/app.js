
import {
  getSkillColorRowByTotalValue
} from './skill-colors.js?v=4_14_33';
import {
  createCard,
  getPartColorClass
} from './card-renderer.js?v=4_14_34';
import {
  renderAccountSwitchRows,
  renderFavoriteRows,
  renderFeedbackHistoryRows,
  renderUserDetailRegisteredSection,
  renderUserDetailSkillSections,
  renderUserListPager,
  renderUserListRow
} from './user-renderer.js?v=4_14_49';
import {
  renderAdminCsvVersionOptions as renderAdminCsvVersionOptionsMarkup,
  renderAdminFeedbackList,
  renderAdminMasterTable,
  renderAdminRequestList,
  renderAdminSettingUsage,
  renderAdminSongPickerOptions,
  renderAdminUserList,
  renderAdminVersionList as renderAdminVersionListMarkup,
  renderAdminVersionManagerLoading
} from './admin-renderer.js?v=4_15_0';
import {
  renderSkillRankingRangeOptions,
  renderSkillRankingRows,
  sortSkillRankingRows
} from './ranking-renderer.js?v=4_14_43';
import { shareGeneratedSkillFiles } from './skill-share.js?v=4_14_44';
import { renderSkillShareFile } from './skill-share-renderer.js?v=4_15_4';
import {
  formatSkillHistoryDate,
  renderSkillHistoryRows,
  serializeSkillHistoryRow
} from './skill-history.js?v=4_14_45';
import {
  detectSkillSyncGuideBrowser,
  getSkillSyncVisualGuideMarkup
} from './skill-sync-guide.js?v=4_14_51';
import {
  buildSkillSyncBookmarklet,
  formatSkillSyncCountText,
  normalizeSkillSyncRecords
} from './skill-sync-data.js?v=4_14_52';
import { csvEscape, parseMasterCsv } from './admin-csv.js?v=4_15_0';
import { adminSongCategory } from './admin-song-utils.js?v=4_15_0';
import {
  renderOptionSummary,
  renderPersonalBest,
  renderRateComparisonRows
} from './score-detail-renderer.js?v=4_15_2';
import { createSiteDialogController } from './site-dialog.js?v=4_15_3';

let adminEnabled = false;
import { supabase } from './supabase.js?v=21_57';
import { register, login, loginForAccountSwitch, logout, changePassword, getSession, validateUsername } from './auth.js?v=4_1_2';
import { initAuthCaptcha, prepareAuthCaptcha, getAuthCaptchaToken, resetAuthCaptcha } from './captcha.js?v=21_84';
import { PARTS, partsForInstrument, normalizeSongTitleForMatch, searchSongTitles, getSongByTitleAndPart, requestSongMaster, requestSongLevelCorrection } from './songs.js?v=4_12_7';
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
  reorderGameVersions,
  deleteGameVersion,
  getAdminSongIdentities,
  getAdminSongIdentitiesByIds
} = adminApi;

// 曲マスター表の列順。admin.jsが古くても画面自体は起動できるようローカルにも保持。
const MASTER_PARTS = adminApi.MASTER_PARTS ?? [
  'BSC-D','ADV-D','EXT-D','MAS-D',
  'BSC-G','ADV-G','EXT-G','MAS-G',
  'BSC-B','ADV-B','EXT-B','MAS-B'
];
const MASTER_CSV_HEADERS = [
  '曲ID', '曲名', '頭文字', '並び順', 'HOT', ...MASTER_PARTS
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

  const rows = normalizeSkillSyncRecords(
    records,
    PARTS,
    normalizeSongTitleForMatch
  );
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

    const countText = formatSkillSyncCountText(payload?.counts, rows.length);

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
  initialGroup = '',
  officialOrder = null,
  isHot = false,
  levels = {}
}) {
  return saveMasterSongRows([{
    originalTitle,
    title,
    initialGroup,
    officialOrder,
    isHot,
    levels
  }], activeVersionId);
}

function collectMasterSongRow(tr) {
  const levels = {};
  MASTER_PARTS.forEach(part => {
    levels[part] = tr.querySelector(`[data-master-level="${part}"]`)?.value ?? '';
  });

  const initialGroup = tr.querySelector('[data-master-initial]')?.value || '';
  const orderRaw = tr.querySelector('[data-master-order]')?.value ?? '';
  const officialOrder = String(orderRaw).trim() === ''
    ? null
    : Number(String(orderRaw).replace(/,/g, ''));
  if (officialOrder != null && (!Number.isFinite(officialOrder) || officialOrder < 0)) {
    throw new Error('並び順は0以上の数値で入力してください。');
  }
  if (!initialGroup) throw new Error('頭文字を選択してください。');
  if (officialOrder == null) throw new Error('並び順を入力してください。');

  return {
    originalTitle: tr.dataset.originalTitle || '',
    title: tr.querySelector('[data-master-title]')?.value || '',
    initialGroup,
    officialOrder,
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
    const result = await getAdminSongMasterPage('', page, pageSize, versionId, '');
    rows.push(...result.rows);
    if (rows.length >= result.total || result.rows.length < pageSize) break;
  }

  return rows;
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
      targetBaseline = targetRowsByTitle.get(row.title) || null;
      baseline = targetBaseline;
    }

    const title = row.title ?? baseline?.title ?? '';
    const initialGroup = row.initialGroup ?? baseline?.initial_group ?? '';
    const officialOrder = row.officialOrder ?? baseline?.official_order ?? null;
    const isHot = row.isHot ?? Boolean(baseline?.is_hot);
    const levels = {};

    MASTER_PARTS.forEach(part => {
      const incoming = row.levels[part];
      levels[part] = incoming == null
        ? (baseline?.levels?.[part] != null ? formatLevel(baseline.levels[part]) : '')
        : incoming;
    });

    if (!title) throw new Error(`${row.rowNumber}行目の曲名がありません。`);
    if (!baseline && !initialGroup) {
      throw new Error(`${row.rowNumber}行目の新規曲には頭文字が必要です。`);
    }
    if (!baseline && officialOrder == null) {
      throw new Error(`${row.rowNumber}行目の新規曲には並び順が必要です。`);
    }
    if (!MASTER_PARTS.some(part => String(levels[part] ?? '').trim() !== '')) {
      throw new Error(`${row.rowNumber}行目は全難易度が空になります。`);
    }

    return {
      originalTitle: targetBaseline?.title || '',
      title,
      initialGroup,
      officialOrder,
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
        row.initial_group || '',
        row.official_order ?? '',
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
  select.innerHTML = renderAdminCsvVersionOptionsMarkup(gameVersions);
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

  const parsedRows = parseMasterCsv(await file.text(), MASTER_PARTS);
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
  const chunkSize = 20;
  let saved = 0;

  const isStatementTimeout = error =>
    String(error?.code || '') === '57014' ||
    /statement timeout|canceling statement due to statement timeout/i.test(
      String(error?.message || error || '')
    );

  // 通常は20曲ずつ処理し、DBがタイムアウトした範囲だけ半分へ分割する。
  // 20 → 10 → 5 → 2/3 → 1曲と縮小するため、一部の重いデータで
  // CSV全体が停止せず、完了済みチャンクも再処理しない。
  const saveChunkWithFallback = async rows => {
    try {
      await saveMasterSongRows(rows, targetVersionId);
      saved += rows.length;
      $('adminCsvStatus').textContent = `${saved} / ${mergedRows.length}曲を処理済み`;
    } catch (error) {
      if (!isStatementTimeout(error) || rows.length <= 1) throw error;

      const middle = Math.ceil(rows.length / 2);
      $('adminCsvStatus').textContent =
        `${saved} / ${mergedRows.length}曲を処理済み（処理単位を縮小して再試行中）`;
      await saveChunkWithFallback(rows.slice(0, middle));
      await saveChunkWithFallback(rows.slice(middle));
    }
  };

  for (let index = 0; index < mergedRows.length; index += chunkSize) {
    const chunk = mergedRows.slice(index, index + chunkSize);
    $('adminCsvStatus').textContent = `${saved} / ${mergedRows.length}曲を処理済み`;
    try {
      await saveChunkWithFallback(chunk);
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

import * as adminApi from './admin.js?v=4_15_0';
import { listUserSummaries, getUserSkillTargets, getSongRateComparison, getSongPersonalBestHistory, getSongOptionDistribution, getMyFavorites, removeFavorite } from './users.js?v=3_6_0';

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
let autoLoadedExistingScore = false;
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
const pendingFavoriteMutations = new Set();
const pendingFavoriteRemovals = new Set();
let favoriteListLoadSeq = 0;
let viewedUserScores = [];
let currentUserId = null;
let viewedUserId = null;
let viewedUserName = '';
let viewedUserProfile = null;
let viewedUserRegisteredScores = [];
let userDetailReturnTarget = null;
const REGISTERED_RECORD_BATCH_SIZE = 50;
const REGISTERED_RECORD_COLUMN_BATCH_SIZE = 25;
let ownRegisteredBatch = 1;
let ownRegisteredViewKey = '';
let viewedUserRegisteredBatch = 1;
let adminPasswordUserId = null;

const $ = id => document.getElementById(id);
const siteDialog = createSiteDialogController($);
const showSiteDialog = siteDialog.showDialog;
const showSiteConfirm = siteDialog.showConfirm;
const showSitePrompt = siteDialog.showPrompt;
const closeSiteDialog = siteDialog.close;

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
      const aOrder = Number.isFinite(a.officialOrder) ? a.officialOrder : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.officialOrder) ? b.officialOrder : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder ||
        a.title.localeCompare(b.title, 'ja', { numeric:true, sensitivity:'base' });
    });

  songSelect.innerHTML = renderAdminSongPickerOptions(rows);
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
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  // PostgRESTの1応答上限を超える公開登録曲も、範囲指定で全件取得する。
  while (true) {
    const { data, error } = await supabase
      .rpc('get_public_user_registered_scores', {
        p_user_id: userId,
        p_instrument: instrument,
        p_version_id: versionId
      })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
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
    await openUserDetail(viewedUserId, viewedUserName, userDetailReturnTarget);
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
  target.innerHTML = renderAccountSwitchRows(accounts, currentUserId);
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
  list.innerHTML = renderSkillHistoryRows(skillHistoryRows, getTotalSkillRank);
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
      [`GITADORA ${snapshot.instrument} SKILL ${Number(snapshot.total).toFixed(2)}`],
      showSiteDialog
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

  await openUserDetail(userId, username, 'rivals');
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
    target.innerHTML = renderFeedbackHistoryRows(
      rows,
      value => new Date(value).toLocaleString('ja-JP')
    );
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

  minSelect.innerHTML = renderSkillRankingRangeOptions('min');
  maxSelect.innerHTML = renderSkillRankingRangeOptions('max');
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

function scrollSkillRankingToTop() {
  const body = document.querySelector('.skill-ranking-body');
  if (!body) return;
  body.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function renderSkillTargetRanking() {
  const list = $('skillRankingList');
  if (!list) return;

  const rows = sortSkillRankingRows(
    skillRankingState.rows.filter(row => row.category === skillRankingState.category),
    skillRankingState.sort
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

  list.innerHTML = renderSkillRankingRows(rows, getPartColorClass);
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
  return renderSkillShareFile({
    instrument,
    snapshot,
    comparisonBaseline,
    currentTotals: totals(instrument),
    currentVersionName: activeVersion?.name || '',
    username: $('headerUsername')?.textContent || ''
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
  await shareGeneratedSkillFiles(files, skillLines, showSiteDialog);
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
  autoLoadedExistingScore = false;
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
  autoLoadedExistingScore = false;
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

  // 新規登録画面から自動的に既存データを読み込んだ後、別の曲・パートへ
  // 変更した場合は通常の新規登録状態へ戻す。
  if (autoLoadedExistingScore) {
    editingScoreId = null;
    autoLoadedExistingScore = false;
    $('domModalTitle').textContent = 'スコア登録';
    $('formRate').value = '';
    $('formFc').value = '';
    $('formOption').value = activeInstrument === 'DM'
      ? 'NORMAL'
      : getGfDefaultOption();
    $('formDmOption').value = 'NORMAL';
    $('formPrivateComment').value = '';
    $('formSkill').textContent = '-';
    $('editDeleteArea').classList.add('hidden');
  }

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

      // 既に登録済みの曲・パートなら現在値を表示し、保存時は既存行を更新する。
      if (!editingScoreId) {
        const existingScore = scores.find(score =>
          String(score.song_id || '') === String(song.id)
        );
        if (existingScore) {
          editingScoreId = existingScore.score_id;
          autoLoadedExistingScore = true;
          $('domModalTitle').textContent = '登録情報の編集';
          $('formRate').value = formatRate(existingScore.achievement_rate);
          $('formFc').value = existingScore.fc === 'FC' ? 'FC' : '';
          $('formOption').value = activeInstrument === 'DM'
            ? 'NORMAL'
            : (existingScore.play_option || getGfDefaultOption());
          $('formDmOption').value =
            activeInstrument === 'DM' && existingScore.play_option === 'BASS_MIRROR'
              ? 'BASS_MIRROR'
              : 'NORMAL';
          $('formPrivateComment').value = existingScore.private_comment || '';
          $('formSkill').textContent = formatSkill(existingScore.skill);
          $('editDeleteArea').classList.remove('hidden');
        }
      }
    } else {
      setMissingMasterState();
    }
  } catch (e) {
    console.error(e);
    setMissingMasterState();
  }

  if (!autoLoadedExistingScore) {
    await applyPreviousScoreSettings(title, part);
  }
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
    return renderUserListRow({
      user,
      gfSkill: gf,
      dmSkill: dm,
      totalSkill: combined,
      gfClass,
      dmClass,
      totalClass,
      rowRank: getTotalSkillRank(Math.max(gf, dm)),
      instrument: activeInstrument,
      formatSkill
    });
  }).join('') || '<div class="empty-state">該当するユーザーがいません</div>';

  const pager = $('userListPager');
  if (pager) {
    if (!users.length || totalPages <= 1) {
      pager.innerHTML = users.length
        ? `<span class="user-list-page-summary">${users.length}件</span>`
        : '';
    } else {
      pager.innerHTML = `
        <div class="user-pager-main">${renderUserListPager({ totalPages, currentPage: userListPage })}</div>
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

  $('userDetailSkill').innerHTML = renderUserDetailSkillSections({
    hotCards: target.hotRows.map((r,i) => createCard(r,i+1,'SKILL')).join(''),
    otherCards: target.otherRows.map((r,i) => createCard(r,i+1,'SKILL')).join('')
  });
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

  $('userDetailRecords').innerHTML = renderUserDetailRegisteredSection({
    totalCount: data.length,
    visibleCount: visibleRows.length,
    cards: renderRegisteredCardList(visibleRows, 'PUBLIC'),
    hasMore
  });
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

async function openUserDetail(userId, username, returnTarget = null) {
  userDetailReturnTarget = returnTarget;
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
  const detailPage = $('userDetailPage');
  detailPage.classList.add('user-detail-open');
  detailPage.style.display = 'flex';

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

function closeUserDetail(returnToOrigin = false) {
  const returnTarget = userDetailReturnTarget;
  const detailPage = $('userDetailPage');
  detailPage.classList.remove('user-detail-open');
  detailPage.style.display = 'none';
  viewedUserScores = [];
  viewedUserRegisteredScores = [];
  viewedUserRegisteredBatch = 1;
  viewedUserProfile = null;
  viewedUserId = null;
  viewedUserName = '';
  userDetailReturnTarget = null;
  $('userDetailXLink').classList.add('hidden');
  $('userDetailTabs').classList.add('hidden');
  setUserDetailTab('skill');

  if (returnToOrigin && returnTarget === 'rivals') {
    openRivalManage();
  }
}

async function toggleFavorite(userId, instrument = activeInstrument) {
  const user = publicUsers.find(u => u.user_id === userId);
  if (!user) return;

  const mutationKey = `${instrument}:${userId}`;
  if (pendingFavoriteMutations.has(mutationKey)) return;

  const isRemoving = Boolean(user.is_favorite && instrument === activeInstrument);
  const originalFavorite = Boolean(user.is_favorite);
  const originalFavoriteRows = [...(favoriteUsers[instrument] || [])];

  if (!isRemoving && originalFavoriteRows.length >= 10) {
    await showSiteDialog('登録人数上限です。', 'ライバル登録');
    return;
  }

  pendingFavoriteMutations.add(mutationKey);
  if (isRemoving) pendingFavoriteRemovals.add(mutationKey);
  user.is_favorite = !isRemoving;
  user.favorite_pending = true;

  if (isRemoving) {
    favoriteUsers[instrument] = originalFavoriteRows.filter(
      favorite => String(favorite.favorite_user_id) !== String(userId)
    );
  } else if (!originalFavoriteRows.some(
    favorite => String(favorite.favorite_user_id) === String(userId)
  )) {
    favoriteUsers[instrument] = [
      ...originalFavoriteRows,
      {
        favorite_user_id: userId,
        username: user.username,
        total_skill: instrument === 'DM' ? user.dm_skill : user.gf_skill
      }
    ];
  }

  renderUsers();
  renderFavorites();

  try {
    if (isRemoving) {
      await removeFavorite(userId, instrument);
    } else {
      const { error: addError } = await supabase.rpc('add_favorite_v2', {
        p_favorite_user_id: userId,
        p_instrument: instrument
      });
      if (addError) throw addError;
    }

    user.favorite_pending = false;
    renderUsers();

    // 星の表示を先に確定し、重い再集計は操作完了後に行う。
    loadUsers().catch(error => console.error('ユーザー一覧再取得失敗:', error));
    loadFavorites().catch(error => console.error('ライバル一覧再取得失敗:', error));
  } catch (e) {
    user.is_favorite = originalFavorite;
    user.favorite_pending = false;
    favoriteUsers[instrument] = originalFavoriteRows;
    renderUsers();
    renderFavorites();

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
  } finally {
    pendingFavoriteMutations.delete(mutationKey);
    pendingFavoriteRemovals.delete(mutationKey);
  }
}

async function removeFavoriteFromManage(userId, instrument) {
  const mutationKey = `${instrument}:${userId}`;
  if (pendingFavoriteMutations.has(mutationKey)) return;

  const originalRows = [...(favoriteUsers[instrument] || [])];
  const target = originalRows.find(
    favorite => String(favorite.favorite_user_id) === String(userId)
  );
  if (!target) return;

  pendingFavoriteMutations.add(mutationKey);
  pendingFavoriteRemovals.add(mutationKey);
  favoriteUsers[instrument] = originalRows.filter(
    favorite => String(favorite.favorite_user_id) !== String(userId)
  );
  renderFavorites();

  const publicUser = publicUsers.find(user => String(user.user_id) === String(userId));
  const originalPublicFavorite = publicUser?.is_favorite;
  if (publicUser && instrument === activeInstrument) {
    publicUser.is_favorite = false;
    renderUsers();
  }

  try {
    await removeFavorite(userId, instrument);
    loadUsers().catch(error => console.error('ユーザー一覧再取得失敗:', error));
    loadFavorites().catch(error => console.error('ライバル一覧再取得失敗:', error));
  } catch (error) {
    favoriteUsers[instrument] = originalRows;
    if (publicUser && instrument === activeInstrument) {
      publicUser.is_favorite = originalPublicFavorite;
      renderUsers();
    }
    renderFavorites();
    await showSiteDialog(
      `ライバルの削除に失敗しました。\n${error?.message || error}`,
      'エラー'
    );
  } finally {
    pendingFavoriteMutations.delete(mutationKey);
    pendingFavoriteRemovals.delete(mutationKey);
  }
}

async function loadFavorites() {
  const requestSeq = ++favoriteListLoadSeq;
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

    // 連続操作中に古い取得結果が返っても、現在の一覧を巻き戻さない。
    if (requestSeq !== favoriteListLoadSeq) return;

    const excludePendingRemovals = (rows, instrument) => rows.filter(
      favorite => !pendingFavoriteRemovals.has(
        `${instrument}:${favorite.favorite_user_id}`
      )
    );

    favoriteUsers = {
      GF: excludePendingRemovals(gfWithSkill, 'GF'),
      DM: excludePendingRemovals(dmWithSkill, 'DM')
    };
    renderFavorites();
  } catch (e) {
    if (requestSeq !== favoriteListLoadSeq) return;
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

  target.innerHTML = renderFavoriteRows({
    rows,
    instrument,
    getTotalSkillRank,
    formatSkill
  });
}

function renderFavorites() {
  renderFavoriteList('GF');
  renderFavoriteList('DM');
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

    const personalBestMarkup = renderPersonalBest(personalBest, part);
    if (personalBestMarkup) {
      $('ratePersonalBest').classList.remove('hidden');
      $('ratePersonalBest').innerHTML = personalBestMarkup;
    } else {
      $('ratePersonalBest').classList.add('hidden');
      $('ratePersonalBest').innerHTML = '';
    }

    $('rateOptionSummary').innerHTML = renderOptionSummary(optionRows, part);
    $('rateCompareBody').innerHTML = renderRateComparisonRows(rows);
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
  else if (tab === 'versions') await loadAdminVersionManager();
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
      $('adminSongTypeFilter')?.value || ''
    );

    const rows = result.rows;
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    // 検索結果が減って現在ページが範囲外になった場合は先頭へ戻す
    if (adminSongPage >= totalPages && adminSongPage > 0) {
      adminSongPage = 0;
      return loadAdminSongs();
    }

    $('adminBody').innerHTML = renderAdminMasterTable({
      rows,
      totalCount: result.total,
      totalPages,
      currentPage: adminSongPage,
      parts: MASTER_PARTS,
      newSongRowVisible: adminNewSongRowVisible,
      formatLevel
    });

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
    $('adminBody').innerHTML = renderAdminRequestList({
      requests: adminRequests,
      parts: PARTS,
      formatLevel
    });
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

    $('adminBody').innerHTML = renderAdminUserList({
      users: sortedUsers,
      formatDate: formatAdminDate
    });
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
    $('adminBody').innerHTML = renderAdminSettingUsage({
      trackedCount,
      totalUsers,
      booleanRows,
      optionRows
    });

    $('btnRefreshAdminSettingUsage')?.addEventListener('click', loadAdminSettingUsage);
  } catch (e) {
    $('adminBody').innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}



async function loadAdminVersionManager() {
  $('adminBody').classList.remove('admin-body-table');
  $('adminBody').innerHTML = renderAdminVersionManagerLoading();

  $('btnRefreshAdminVersions')?.addEventListener('click', loadAdminVersionManager);

  try {
    gameVersions = await getGameVersions();
    renderAdminVersionList(gameVersions);
  } catch (e) {
    const container = $('adminVersionManager');
    if (container) container.innerHTML = `<div class="empty-state">取得失敗: ${esc(e.message)}</div>`;
  }
}

function renderAdminVersionList(versions) {
  const container = $('adminVersionManager');
  if (!container) return;

  container.innerHTML = renderAdminVersionListMarkup(versions);

  $('btnRefreshAdminVersions')?.addEventListener('click', loadAdminVersionManager);

  container.querySelectorAll('.admin-version-row').forEach((row, index) => {
    const versionId = row.dataset.versionId;
    row.querySelector('.btn-version-up')
      ?.addEventListener('click', () => moveAdminVersion(versions, index, index - 1));
    row.querySelector('.btn-version-down')
      ?.addEventListener('click', () => moveAdminVersion(versions, index, index + 1));
    row.querySelector('.btn-version-delete')
      ?.addEventListener('click', () => removeAdminVersion(versions, versionId));
  });
}

async function moveAdminVersion(versions, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= versions.length) return;
  const reordered = versions.slice();
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  try {
    await reorderGameVersions(reordered.map(v => v.id));
    gameVersions = await getGameVersions();
    renderAdminVersionList(gameVersions);
  } catch (e) {
    await showSiteDialog('並び替えに失敗しました: ' + e.message, 'エラー');
  }
}

async function removeAdminVersion(versions, versionId) {
  const target = versions.find(v => v.id === versionId);
  const confirmed = await showSiteConfirm(
    `「${target?.name || ''}」を削除します。この操作は取り消せません。`,
    'バージョン削除',
    '削除する'
  );
  if (!confirmed) return;

  try {
    await deleteGameVersion(versionId);
    gameVersions = await getGameVersions();
    renderAdminVersionList(gameVersions);
  } catch (e) {
    await showSiteDialog('削除に失敗しました: ' + e.message, 'エラー');
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

    $('adminBody').innerHTML = renderAdminFeedbackList({
      items: adminFeedback,
      getUsername: userId => usernameMap.get(userId),
      formatDate: value => new Date(value).toLocaleString('ja-JP')
    });
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
$('adminSongTypeFilter')?.addEventListener('change', () => {
  adminSongPage = 0;
  loadAdminSongs();
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
    const rows = parseMasterCsv(await file.text(), MASTER_PARTS);
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

$('btnCloseUserDetail').addEventListener('click', () => closeUserDetail(true));
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
    await removeFavoriteFromManage(
      favoriteRemove.dataset.favoriteRemove,
      favoriteRemove.dataset.favoriteInstrument || 'GF'
    );
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
  if (e.target === $('siteDialogMask')) closeSiteDialog(siteDialog.isConfirmMode() ? false : true);
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

window.addEventListener('resize', () => {
  syncRegisteredEditButtonWidths();
});

[
  document.querySelector('#appScreen > .p-container'),
  $('userDetailSkill'),
  $('userDetailRecords'),
  $('adminBody')
].filter(Boolean).forEach(scroller => {
  scroller.addEventListener('scroll', markAppScrolling, { passive:true });
});
applyLightMode();

init().catch(err => {
  console.error(err);
  showSiteDialog('初期化に失敗しました: ' + err.message, '初期化エラー');
});
