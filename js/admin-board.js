import { supabase } from './supabase.js?v=21_57';

export const BOARD_BUCKET = 'board-images';
export const BOARD_TITLE_MAX = 80;
export const BOARD_BODY_MAX = 2000;
export const BOARD_IMAGE_MAX_COUNT = 4;
export const BOARD_SOURCE_MAX_BYTES = 12 * 1024 * 1024;
export const BOARD_IMAGE_TARGET_BYTES = 900 * 1024;
export const BOARD_IMAGE_MAX_EDGE = 1600;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

function formatDate(value) {
  return value ? new Date(value).toLocaleString('ja-JP') : '';
}

export async function getAdminBoardThreads() {
  const { data, error } = await supabase.rpc('admin_board_list_threads');
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
  if (!cleanBody) throw new Error('返信本文を入力してください。');
  if (cleanBody.length > BOARD_BODY_MAX) throw new Error(`返信は${BOARD_BODY_MAX}文字以内です。`);
  const { data, error } = await supabase.rpc('admin_board_create_reply', {
    p_thread_id: threadId,
    p_body: cleanBody
  });
  if (error) throw error;
  return data;
}

export async function updateAdminBoardReply(postId, body) {
  const cleanBody = String(body || '').trim();
  if (!cleanBody) throw new Error('返信本文を入力してください。');
  if (cleanBody.length > BOARD_BODY_MAX) throw new Error(`返信は${BOARD_BODY_MAX}文字以内です。`);
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
  const { data, error } = await supabase.rpc('admin_board_list_reports');
  if (error) throw error;
  return data ?? [];
}

export async function resolveAdminBoardReport(reportId, note = '') {
  const { error } = await supabase.rpc('admin_board_resolve_report', {
    p_report_id: reportId,
    p_note: String(note || '').trim()
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

  const scale = Math.min(1, BOARD_IMAGE_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.round(sourceWidth * scale));
  let height = Math.max(1, Math.round(sourceHeight * scale));
  let quality = 0.78;
  let blob = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasBlob(canvas, 'image/webp', quality);
    if (!blob) blob = await canvasBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= BOARD_IMAGE_TARGET_BYTES) break;
    quality = Math.max(0.52, quality - 0.08);
    if (attempt >= 2) {
      width = Math.max(1, Math.round(width * 0.88));
      height = Math.max(1, Math.round(height * 0.88));
    }
  }
  bitmap.close?.();
  if (!blob) throw new Error('画像の圧縮に失敗しました。');
  if (blob.size > 1200 * 1024) throw new Error('画像を十分に圧縮できませんでした。別の画像を選択してください。');
  return { blob, width, height, mimeType: blob.type || 'image/webp' };
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

export function renderAdminBoardThreadList(threads) {
  if (!threads.length) return '<div class="empty-state">スレッドはまだありません。</div>';
  return `<div class="admin-board-thread-list">${threads.map(thread => `
    <button type="button" class="admin-board-thread-card" data-board-open-thread="${thread.id}">
      <div class="admin-board-thread-title">${esc(thread.title)}</div>
      <div class="admin-board-thread-meta">
        <span data-board-open-user="${thread.author_id}" data-board-open-user-name="${esc(thread.username)}">${esc(thread.username)}</span>
        <span>${formatDate(thread.created_at)}</span>
        ${thread.updated_at && thread.updated_at !== thread.created_at ? '<span>編集済み</span>' : ''}
      </div>
      <div class="admin-board-thread-excerpt">${esc(thread.body_excerpt)}</div>
      <div class="admin-board-thread-counts">返信 ${Number(thread.reply_count) || 0} / 画像 ${Number(thread.image_count) || 0}</div>
    </button>`).join('')}</div>`;
}

function renderImageGrid(images) {
  if (!images?.length) return '';
  return `<div class="admin-board-image-grid">${images.map(image => `
    <a href="${esc(image.signed_url)}" target="_blank" rel="noopener noreferrer">
      <img src="${esc(image.signed_url)}" alt="投稿画像" loading="lazy">
    </a>`).join('')}</div>`;
}

export function renderAdminBoardThreadDetail(data) {
  if (!data?.thread) return '<div class="empty-state">スレッドを取得できませんでした。</div>';
  const thread = data.thread;
  const replies = data.replies || [];
  return `
    <article class="admin-board-main-post ${thread.deleted_at ? 'is-deleted' : ''}">
      <h3>${esc(thread.title)}</h3>
      <button type="button" class="admin-board-author" data-board-open-user="${thread.author_id}" data-board-open-user-name="${esc(thread.username)}">${esc(thread.username)}</button>
      <div class="admin-board-post-date">${formatDate(thread.created_at)}${thread.updated_at !== thread.created_at ? ' ・ 編集済み ' + formatDate(thread.updated_at) : ''}</div>
      <div class="admin-board-post-body">${esc(thread.body).replace(/\n/g, '<br>')}</div>
      ${renderImageGrid(thread.images)}
      <div class="admin-board-post-actions">
        <button type="button" data-board-edit-thread="${thread.id}">編集</button>
        <button type="button" class="danger" data-board-delete-thread="${thread.id}">削除</button>
      </div>
    </article>
    <div class="admin-board-replies">${replies.map(reply => `
      <article class="admin-board-reply ${reply.deleted_at ? 'is-deleted' : ''}">
        <button type="button" class="admin-board-author" data-board-open-user="${reply.author_id}" data-board-open-user-name="${esc(reply.username)}">${esc(reply.username)}</button>
        <div class="admin-board-post-date">${formatDate(reply.created_at)}${reply.updated_at !== reply.created_at ? ' ・ 編集済み ' + formatDate(reply.updated_at) : ''}</div>
        <div class="admin-board-post-body">${esc(reply.body).replace(/\n/g, '<br>')}</div>
        ${renderImageGrid(reply.images)}
        <div class="admin-board-post-actions">
          <button type="button" data-board-edit-reply="${reply.id}">編集</button>
          <button type="button" class="danger" data-board-delete-reply="${reply.id}">削除</button>
        </div>
      </article>`).join('') || '<div class="empty-state">返信はまだありません。</div>'}</div>
    <div class="admin-board-reply-form">
      <label for="adminBoardReplyBody">返信</label>
      <textarea id="adminBoardReplyBody" maxlength="${BOARD_BODY_MAX}" placeholder="返信を入力"></textarea>
      <div class="admin-board-image-actions">
        <label class="admin-board-file-button">画像を選択<input id="adminBoardReplyImages" type="file" accept="image/*" multiple></label>
        <label class="admin-board-file-button">カメラ<input id="adminBoardReplyCamera" type="file" accept="image/*" capture="environment"></label>
        <span>最大4枚・保存時に自動圧縮</span>
      </div>
      <button id="btnAdminBoardReply" type="button" class="btn-submit">返信する</button>
    </div>`;
}

export function renderAdminBoardReports(reports) {
  if (!reports.length) return '<div class="empty-state">未対応の通報はありません。</div>';
  return `<div class="admin-board-report-list">${reports.map(report => `
    <article class="admin-card admin-board-report-card">
      <strong>${esc(report.reason)}</strong>
      <div>${esc(report.target_text || '')}</div>
      <div class="admin-card-meta">通報者 ${esc(report.reporter_username)} / ${formatDate(report.created_at)}</div>
      ${report.details ? `<div class="admin-board-report-details">${esc(report.details)}</div>` : ''}
      <button type="button" data-board-resolve-report="${report.id}">対応済みにする</button>
    </article>`).join('')}</div>`;
}
