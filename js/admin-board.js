import { supabase } from './supabase.js?v=21_57';

export const BOARD_BUCKET = 'board-images';
export const BOARD_TITLE_MAX = 30;
export const BOARD_BODY_MAX = 1000;
export const BOARD_IMAGE_MAX_COUNT = 1;
export const BOARD_SOURCE_MAX_BYTES = 12 * 1024 * 1024;
export const BOARD_IMAGE_MAX_EDGE = 960;
export const BOARD_THREAD_PAGE_SIZE = 10;
export const BOARD_REPLY_PAGE_SIZE = 10;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

function formatDate(value) {
  return value ? new Date(value).toLocaleString('ja-JP') : '';
}

function formatThreadListDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${String(d.getFullYear()).slice(-2)}/${d.getMonth() + 1}/${d.getDate()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

export async function getAdminBoardThreads() {
  const { data, error } = await supabase.rpc('admin_board_list_threads_v2');
  if (error) throw error;
  return data ?? [];
}

export async function getAdminBoardThread(threadId) {
  const { data, error } = await supabase.rpc('admin_board_get_thread', { p_thread_id: threadId });
  if (error) throw error;
  return data ?? null;
}

export async function createAdminBoardThread(title, body) {
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanTitle) throw new Error('タイトルを入力してください。');
  if (cleanTitle.length > BOARD_TITLE_MAX) throw new Error(`タイトルは${BOARD_TITLE_MAX}文字以内です。`);
  if (!cleanBody) throw new Error('本文を入力してください。');
  if (cleanBody.length > BOARD_BODY_MAX) throw new Error(`本文は${BOARD_BODY_MAX}文字以内です。`);
  const { data, error } = await supabase.rpc('admin_board_create_thread', {
    p_title: cleanTitle,
    p_body: cleanBody
  });
  if (error) throw error;
  return data;
}

export async function updateAdminBoardThread(threadId, title, body) {
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanTitle) throw new Error('タイトルを入力してください。');
  if (cleanTitle.length > BOARD_TITLE_MAX) throw new Error(`タイトルは${BOARD_TITLE_MAX}文字以内です。`);
  if (!cleanBody) throw new Error('本文を入力してください。');
  if (cleanBody.length > BOARD_BODY_MAX) throw new Error(`本文は${BOARD_BODY_MAX}文字以内です。`);
  const { error } = await supabase.rpc('admin_board_update_thread', {
    p_thread_id: threadId,
    p_title: cleanTitle,
    p_body: cleanBody
  });
  if (error) throw error;
}

export async function createAdminBoardReply(threadId, body) {
  const cleanBody = String(body || '').trim();
  if (!cleanBody) throw new Error('本文を入力してください。');
  if (cleanBody.length > BOARD_BODY_MAX) throw new Error(`本文は${BOARD_BODY_MAX}文字以内です。`);
  const { data, error } = await supabase.rpc('admin_board_create_reply', {
    p_thread_id: threadId,
    p_body: cleanBody
  });
  if (error) throw error;
  return data;
}

export async function updateAdminBoardReply(postId, body) {
  const cleanBody = String(body || '').trim();
  if (!cleanBody) throw new Error('本文を入力してください。');
  if (cleanBody.length > BOARD_BODY_MAX) throw new Error(`本文は${BOARD_BODY_MAX}文字以内です。`);
  const { error } = await supabase.rpc('admin_board_update_reply', {
    p_post_id: postId,
    p_body: cleanBody
  });
  if (error) throw error;
}

export async function softDeleteAdminBoardThread(threadId) {
  const { error } = await supabase.rpc('admin_board_soft_delete_thread', { p_thread_id: threadId });
  if (error) throw error;
}

export async function softDeleteAdminBoardReply(postId) {
  const { error } = await supabase.rpc('admin_board_soft_delete_reply', { p_post_id: postId });
  if (error) throw error;
}

export async function listAdminBoardReports() {
  const { data, error } = await supabase.rpc('admin_board_list_reports_v2');
  if (error) throw error;
  return data ?? [];
}

export async function getAdminBoardStorageUsage() {
  const { data, error } = await supabase.rpc('admin_board_storage_usage');
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return row || { used_bytes: 0, image_count: 0 };
}

export async function resolveAdminBoardReport(reportId, note = '') {
  const { error } = await supabase.rpc('admin_board_resolve_report', {
    p_report_id: reportId,
    p_note: String(note || '').trim()
  });
  if (error) throw error;
}

export async function createAdminBoardReport({ threadId = null, postId = null, reason, details = '' }) {
  const cleanReason = String(reason || '').trim();
  const cleanDetails = String(details || '').trim();
  if (!cleanReason) throw new Error('通報理由を選択してください。');
  if (cleanDetails.length > 500) throw new Error('通報の詳細は500文字以内です。');
  const { error } = await supabase.rpc('admin_board_create_report', {
    p_thread_id: threadId,
    p_post_id: postId,
    p_reason: cleanReason,
    p_details: cleanDetails || null
  });
  if (error) throw error;
}

export async function getBoardUserState(userId) {
  const { data, error } = await supabase.rpc('admin_board_get_user_state', { p_user_id: userId });
  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function listBoardUserStates() {
  const { data, error } = await supabase.rpc('admin_board_list_user_states');
  if (error) throw error;
  return data ?? [];
}

export async function setBoardUserBlocked(userId, blocked, reason = '') {
  const { error } = await supabase.rpc('admin_board_set_user_blocked', {
    p_user_id: userId,
    p_blocked: Boolean(blocked),
    p_reason: String(reason || '').trim() || null
  });
  if (error) throw error;
}

async function loadImage(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('画像を読み込めませんでした。'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

export async function compressBoardImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('画像ファイルのみ添付できます。');
  }
  if (file.size > BOARD_SOURCE_MAX_BYTES) {
    throw new Error('元画像は1枚12MB以下にしてください。');
  }

  const bitmap = await loadImage(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('画像サイズを取得できませんでした。');

  const baseScale = Math.min(1, BOARD_IMAGE_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  // 固定容量の達成可否では弾かず、読み取りやすさを残しながら段階的に強く圧縮し、
  // 生成できた候補のうち最小サイズを採用する。
  const candidates = [
    { scale: baseScale, quality: 0.56 },
    { scale: Math.min(baseScale, 0.88), quality: 0.50 },
    { scale: Math.min(baseScale, 0.78), quality: 0.44 },
    { scale: Math.min(baseScale, 0.68), quality: 0.40 },
    { scale: Math.min(baseScale, 0.58), quality: 0.36 }
  ];
  let best = null;
  let bestWidth = 0;
  let bestHeight = 0;

  try {
    for (const candidate of candidates) {
      const width = Math.max(1, Math.round(sourceWidth * candidate.scale));
      const height = Math.max(1, Math.round(sourceHeight * candidate.scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) continue;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);
      const blobs = [
        await canvasBlob(canvas, 'image/webp', candidate.quality),
        await canvasBlob(canvas, 'image/jpeg', candidate.quality)
      ].filter(Boolean);
      for (const blob of blobs) {
        if (!best || blob.size < best.size) {
          best = blob;
          bestWidth = width;
          bestHeight = height;
        }
      }
    }
  } finally {
    bitmap.close?.();
  }

  if (!best) throw new Error('画像を圧縮できませんでした。別の画像を選択してください。');
  return { blob: best, width: bestWidth, height: bestHeight, mimeType: best.type || 'image/webp' };
}

function storageExtension(mimeType) {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
}

export async function uploadBoardImages({ files, threadId, postId = null, existingCount = 0 }) {
  const sourceFiles = Array.from(files || []);
  if (existingCount + sourceFiles.length > BOARD_IMAGE_MAX_COUNT) {
    throw new Error(`画像は1投稿につき${BOARD_IMAGE_MAX_COUNT}枚までです。`);
  }
  if (!sourceFiles.length) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData?.user?.id;
  if (!userId) throw new Error('ログイン情報を確認できません。');

  const uploaded = [];
  try {
    for (let index = 0; index < sourceFiles.length; index += 1) {
      const converted = await compressBoardImage(sourceFiles[index]);
      const extension = storageExtension(converted.mimeType);
      const itemKey = postId || 'thread';
      const path = `${userId}/${threadId}/${itemKey}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(BOARD_BUCKET)
        .upload(path, converted.blob, { contentType: converted.mimeType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: imageId, error: rowError } = await supabase.rpc('admin_board_add_image', {
        p_thread_id: threadId,
        p_post_id: postId,
        p_storage_path: path,
        p_mime_type: converted.mimeType,
        p_size_bytes: converted.blob.size,
        p_width: converted.width,
        p_height: converted.height,
        p_sort_order: existingCount + index
      });
      if (rowError) {
        await supabase.storage.from(BOARD_BUCKET).remove([path]);
        throw rowError;
      }
      uploaded.push({ id: imageId, storage_path: path });
    }
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from(BOARD_BUCKET).remove(uploaded.map(item => item.storage_path));
      for (const item of uploaded) {
        await supabase.rpc('admin_board_remove_image_record', { p_image_id: item.id });
      }
    }
    throw error;
  }
  return uploaded;
}

export async function removeBoardImages(images) {
  const rows = Array.from(images || []).filter(item => item?.id && item?.storage_path);
  if (!rows.length) return;
  const { error: storageError } = await supabase.storage
    .from(BOARD_BUCKET)
    .remove(rows.map(item => item.storage_path));
  if (storageError) throw storageError;
  for (const row of rows) {
    const { error } = await supabase.rpc('admin_board_remove_image_record', { p_image_id: row.id });
    if (error) throw error;
  }
}

export async function signedBoardImageUrls(images) {
  const rows = Array.from(images || []);
  if (!rows.length) return [];
  const paths = rows.map(row => row.storage_path);
  const { data, error } = await supabase.storage.from(BOARD_BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  return rows.map((row, index) => ({ ...row, signed_url: data?.[index]?.signedUrl || '' }));
}

export function renderAdminBoardThreadList(threads, { page = 1, totalPages = 1, emptyMessage = 'スレッドはまだありません。' } = {}) {
  if (!threads.length) return `<div class="empty-state">${esc(emptyMessage)}</div>`;
  const rows = threads.map(thread => `
    <button type="button" class="admin-board-thread-card" data-board-open-thread="${thread.id}">
      <div class="admin-board-thread-title" title="${esc(thread.title)}">${esc(thread.title)}</div>
      <div class="admin-board-thread-info admin-board-thread-info-primary">
        <span class="admin-board-thread-author-label">投稿者</span>
        <span class="admin-board-thread-author" data-board-open-user="${thread.author_id}" data-board-open-user-name="${esc(thread.username)}">${esc(thread.username)}</span>
      </div>
      <div class="admin-board-thread-summary">
        <span>投稿 ${Math.max(1, (Number(thread.reply_count) || 0) + 1)}</span>
        <span>画像 ${Number(thread.image_count) || 0}</span>
        <span>作成 ${formatThreadListDate(thread.created_at)}</span>
        <span>更新 ${formatThreadListDate(thread.activity_at || thread.created_at)}</span>
      </div>
    </button>`).join('');
  return `<div class="admin-board-thread-list">${rows}</div>${renderPager('threads', page, totalPages)}`;
}

function renderPager(kind, page, totalPages) {
  if (totalPages <= 1) return '';
  return `<div class="admin-board-pager" data-board-pager="${kind}">
    <button type="button" data-board-page-prev="${kind}" ${page <= 1 ? 'disabled' : ''}>◀</button>
    <span>${page} / ${totalPages}</span>
    <button type="button" data-board-page-next="${kind}" ${page >= totalPages ? 'disabled' : ''}>▶</button>
  </div>`;
}

function renderImageGrid(images) {
  if (!images?.length) return '';
  return `<div class="admin-board-image-grid">${images.map((image, index) => `
    <button type="button" class="admin-board-image-thumb" data-board-image-url="${esc(image.signed_url)}" data-board-image-index="${index}">
      <img src="${esc(image.signed_url)}" alt="投稿画像 ${index + 1}" loading="lazy">
    </button>`).join('')}</div>`;
}

function renderPostBody(body) {
  const safe = esc(body).replace(/\n/g, '<br>');
  return safe.replace(/&gt;(\d+)/g, '<button type="button" class="admin-board-quote-link" data-board-jump-post="$1">&gt;$1</button>');
}

function renderPostImages(images, imageIndex, altPrefix = '投稿画像') {
  if (!images?.length) return '';
  return `<div class="admin-board-image-grid">${images.map((image, index) => `
    <button type="button" class="admin-board-image-thumb" data-board-image-id="${image.id}">
      <img src="${esc(image.signed_url)}" alt="${altPrefix} ${index + 1}" loading="lazy" decoding="async" fetchpriority="low">
    </button>`).join('')}</div>`;
}

export function renderAdminBoardThreadDetail(data, { replyPage = 1, replyTotalPages = 1, replyStart = 0, replyEnd = null, viewerUserId = null, viewerIsAdmin = false } = {}) {
  if (!data?.thread) return '<div class="empty-state">スレッドを取得できませんでした。</div>';
  const thread = data.thread;
  const allReplies = data.replies || [];
  const replies = allReplies.slice(replyStart, replyEnd ?? allReplies.length);
  const allImages = [
    ...(thread.images || []),
    ...allReplies.flatMap(reply => reply.images || [])
  ];
  const imageIndex = image => allImages.findIndex(item => item.id === image.id);
  const threadImageGrid = renderPostImages(thread.images || [], imageIndex, '投稿画像');
  const threadIsOwn = String(thread.author_id || '') === String(viewerUserId || '');
  const replyHtml = replies.map((reply, localIndex) => {
    const globalNumber = Number(reply.post_number) || (replyStart + localIndex + 2);
    const replyImages = renderPostImages(reply.images || [], imageIndex, '投稿画像');
    const isOwn = String(reply.author_id || '') === String(viewerUserId || '');
    return `
      <article class="admin-board-reply ${reply.deleted_at ? 'is-deleted' : ''}" data-board-post-number="${globalNumber}">
        ${!isOwn ? `<button type="button" class="admin-board-report-top" data-board-report-post="${reply.id}">通報</button>` : ''}
        <div class="admin-board-post-heading"><span class="admin-board-post-number">${globalNumber}.</span><button type="button" class="admin-board-author" data-board-open-user="${reply.author_id}" data-board-open-user-name="${esc(reply.username)}">${esc(reply.username)}</button></div>
        <div class="admin-board-post-date">${formatDate(reply.created_at)}${reply.updated_at !== reply.created_at ? ' ・ 編集済み ' + formatDate(reply.updated_at) : ''}</div>
        <div class="admin-board-post-body">${renderPostBody(reply.body)}</div>
        ${replyImages}
        <div class="admin-board-post-actions">
          <button type="button" data-board-reply-to="${globalNumber}">返信</button>
          ${isOwn ? `<button type="button" data-board-edit-reply="${reply.id}">編集</button>` : ''}
          ${(isOwn || viewerIsAdmin) ? `<button type="button" class="danger" data-board-delete-reply="${reply.id}">削除</button>` : ''}
        </div>
      </article>`;
  }).join('');
  return `
    <article class="admin-board-main-post ${thread.deleted_at ? 'is-deleted' : ''}" data-board-post-number="1">
      ${!threadIsOwn ? `<button type="button" class="admin-board-report-top" data-board-report-thread="${thread.id}">通報</button>` : ''}
      <h3>${esc(thread.title)}</h3>
      <div class="admin-board-post-heading"><span class="admin-board-post-number">1.</span><button type="button" class="admin-board-author" data-board-open-user="${thread.author_id}" data-board-open-user-name="${esc(thread.username)}">${esc(thread.username)}</button></div>
      <div class="admin-board-post-date">${formatDate(thread.created_at)}${thread.updated_at !== thread.created_at ? ' ・ 編集済み ' + formatDate(thread.updated_at) : ''}</div>
      <div class="admin-board-post-body">${renderPostBody(thread.body)}</div>
      ${threadImageGrid}
      <div class="admin-board-post-actions">
        <button type="button" data-board-reply-to="1">返信</button>
        ${threadIsOwn ? `<button type="button" data-board-edit-thread="${thread.id}">編集</button>` : ''}
        ${(threadIsOwn || viewerIsAdmin) ? `<button type="button" class="danger" data-board-delete-thread="${thread.id}">削除</button>` : ''}
      </div>
    </article>
    <div class="admin-board-replies">${replyHtml}</div>
    ${renderPager('replies', replyPage, replyTotalPages)}
    <div class="admin-board-reply-form">
      <label for="adminBoardReplyBody">投稿</label>
      <textarea id="adminBoardReplyBody" maxlength="${BOARD_BODY_MAX}" placeholder="本文（${BOARD_BODY_MAX}文字まで）"></textarea>
      <div id="adminBoardReplySelectedImages" class="admin-board-selected-images"></div>
      <div class="admin-board-reply-bottom">
        <div class="admin-board-image-actions">
          <label class="admin-board-file-button">画像添付<input id="adminBoardReplyImages" type="file" accept="image/*"></label>
        </div>
        <button id="btnAdminBoardReply" type="button" class="btn-submit">投稿する</button>
      </div>
    </div>`;
}

export function getThreadImageItems(data) {
  if (!data?.thread) return [];
  const items = [];
  for (const image of data.thread.images || []) {
    if (image.signed_url) items.push({ id:image.id, url:image.signed_url, postNumber:1 });
  }
  (data.replies || []).forEach((reply, index) => {
    const postNumber = index + 2;
    for (const image of reply.images || []) {
      if (image.signed_url) items.push({ id:image.id, url:image.signed_url, postNumber });
    }
  });
  return items;
}

export function renderSelectedFilePreview(files) {
  const rows = Array.from(files || []);
  if (!rows.length) return '';
  return `<div class="admin-board-selected-title">添付中 ${rows.length}枚</div>
    <div class="admin-board-selected-grid">${rows.map((file, index) => `
      <div class="admin-board-selected-item">
        <img data-board-local-preview="${index}" alt="添付予定画像 ${index + 1}">
        <span>${esc(file.name || `画像${index + 1}`)}</span>
      </div>`).join('')}</div>`;
}

export function renderAdminBoardBlockedUsers(users) {
  const rows = Array.from(users || []).filter(user => user?.board_posting_blocked);
  if (!rows.length) return '<div class="empty-state">投稿禁止ユーザーはいません。</div>';
  return `<div class="admin-board-blocked-list">${rows.map(user => `
    <article class="admin-card admin-board-blocked-card">
      <div class="admin-card-meta">ユーザー</div>
      <button type="button" class="admin-board-report-user" data-board-open-user="${user.id}" data-board-open-user-name="${esc(user.username || '')}">${esc(user.username || '不明')}</button>
      <div class="admin-card-meta admin-board-blocked-reason-label">理由</div>
      <div class="admin-board-blocked-reason">${esc(user.board_blocked_reason || '理由なし')}</div>
      <button type="button" class="admin-board-unblock" data-board-unblock-user="${user.id}">解除</button>
    </article>`).join('')}</div>`;
}

export function renderAdminBoardReports(reports) {
  if (!reports.length) return '<div class="empty-state">未対応の通報はありません。</div>';
  return `<div class="admin-board-report-list">${reports.map(report => `
    <article class="admin-card admin-board-report-card" data-board-report-open="1" data-board-report-thread-id="${report.target_thread_id || report.thread_id || ''}" data-board-report-post-id="${report.target_post_id || report.post_id || ''}">
      <div class="admin-card-meta">通報されたユーザー <button type="button" class="admin-board-report-user" data-board-open-user="${report.target_author_id || ''}" data-board-open-user-name="${esc(report.target_username || '')}">${esc(report.target_username || '不明')}</button></div>
      <strong>${esc(report.reason)}</strong>
      ${report.details ? `<div class="admin-board-report-details">${esc(report.details)}</div>` : '<div class="admin-board-report-details is-empty">詳細なし</div>'}
      <div class="admin-card-meta">通報者 ${esc(report.reporter_username)} / ${formatDate(report.created_at)}</div>
      <button type="button" data-board-resolve-report="${report.id}">対応済みにする</button>
    </article>`).join('')}</div>`;
}
