// GD Pocket Board admin.js v14_2
import { supabase } from './supabase.js';

export async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return data === true;
}

export async function getAdminSongs(keyword = '') {
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('songs').select('id,is_hot,title,part,level')
      .order('title', { ascending: true }).order('part', { ascending: true })
      .range(from, from + pageSize - 1);
    if (keyword.trim()) query = query.ilike('title', `%${keyword.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export async function getAdminSongMasterPage(
  keyword = '',
  page = 0,
  pageSize = 100,
  versionId = null,
  typeFilter = ''
) {
  const safePage = Math.max(0, Number(page) || 0);
  const safeSize = Math.min(200, Math.max(25, Number(pageSize) || 100));

  const { data, error } = await supabase.rpc('admin_list_song_master_ordered', {
    p_search: String(keyword || '').trim(),
    p_limit: safeSize,
    p_offset: safePage * safeSize,
    p_version_id: versionId,
    p_type_filter: String(typeFilter || '').trim().toUpperCase()
  });

  if (error) throw error;

  const rows = (data ?? []).map(row => ({
    title: row.title,
    initial_group: row.initial_group || '',
    official_order: row.official_order == null ? null : Number(row.official_order),
    is_hot: Boolean(row.is_hot),
    levels: row.levels ?? {},
    total_count: Number(row.total_count) || 0
  }));

  return {
    rows,
    total: rows[0]?.total_count ?? 0,
    page: safePage,
    pageSize: safeSize
  };
}

export async function getAdminSongPickerChoices(versionId, instrument = 'GF') {
  const all = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.rpc('list_song_picker_ordered', {
      p_version_id: versionId,
      p_instrument: instrument === 'DM' ? 'DM' : 'GF',
      p_limit: pageSize,
      p_offset: offset
    });
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return all.map(row => ({
    title: row.title,
    initialGroup: row.initial_group || '',
    officialOrder: row.official_order == null ? null : Number(row.official_order),
    isHot: Boolean(row.is_hot)
  }));
}

export async function createGameVersion({
  code,
  name,
  eamusementSlug,
  makeCurrent = true
}) {
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanName = String(name || '').trim();
  const cleanSlug = String(eamusementSlug || '').trim().toLowerCase();

  if (!/^[A-Z0-9_]+$/.test(cleanCode)) {
    throw new Error('バージョンコードは半角英大文字・数字・_で入力してください。');
  }
  if (!cleanName) throw new Error('表示名を入力してください。');
  if (!/^[a-z0-9_-]+$/.test(cleanSlug)) {
    throw new Error('e-amusementスラッグは半角英小文字・数字・_・-で入力してください。');
  }

  const { data, error } = await supabase.rpc('admin_create_game_version', {
    p_code: cleanCode,
    p_name: cleanName,
    p_eamusement_slug: cleanSlug,
    p_make_current: Boolean(makeCurrent)
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function reorderGameVersions(orderedVersionIds) {
  const ids = (orderedVersionIds ?? []).map(id => String(id || '').trim()).filter(Boolean);
  if (!ids.length) throw new Error('並び替える対象がありません。');

  const { error } = await supabase.rpc('admin_reorder_game_versions', {
    p_version_ids: ids
  });
  if (error) throw error;
}

export async function deleteGameVersion(versionId) {
  const cleanId = String(versionId || '').trim();
  if (!cleanId) throw new Error('バージョンを選択してください。');

  const { error } = await supabase.rpc('admin_delete_game_version', {
    p_version_id: cleanId
  });
  if (error) throw error;
}

export async function getAdminSongIdentities(versionId) {
  const all = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('songs')
      .select('id,title,part,version_id')
      .eq('version_id', versionId)
      .order('title', { ascending: true })
      .order('part', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return all;
}

export async function getAdminSongIdentitiesByIds(songIds) {
  const ids = [...new Set((songIds ?? []).map(value => String(value || '').trim()).filter(Boolean))];
  const all = [];
  const chunkSize = 100;

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from('songs')
      .select('id,title,part,version_id')
      .in('id', chunk);
    if (error) throw error;
    all.push(...(data ?? []));
  }

  return all;
}

export async function saveMasterSongRows(rows, versionId) {
  const payload = (rows ?? []).map(row => ({
    original_title: String(row.originalTitle || '').trim(),
    title: String(row.title || '').trim(),
    initial_group: String(row.initialGroup || '').trim() || null,
    official_order: row.officialOrder == null || row.officialOrder === ''
      ? null
      : Number(row.officialOrder),
    is_hot: Boolean(row.isHot),
    levels: row.levels ?? {}
  }));

  const { data, error } = await supabase.rpc('admin_save_song_master_rows_atomic', {
    p_rows: payload,
    p_version_id: versionId
  });
  if (error) throw error;

  return Number(data) || 0;
}

export async function saveMasterSong({ id = null, isHot = false, title, part, level, versionId = null }) {
  const cleanTitle = String(title || '').trim();
  const numericLevel = Number(level);

  if (!cleanTitle) throw new Error('曲名を入力してください。');
  if (!part) throw new Error('Partを選択してください。');
  if (!Number.isFinite(numericLevel)) throw new Error('難易度を入力してください。');

  const { error } = await supabase.rpc('admin_save_song_master_atomic', {
    p_id: id || null,
    p_is_hot: Boolean(isHot),
    p_title: cleanTitle,
    p_part: part,
    p_level: Math.round((numericLevel + Number.EPSILON) * 100) / 100,
    p_version_id: versionId
  });
  if (error) throw error;
}

export async function deleteMasterSong(id) {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
}

export async function getAdminUsers(keyword = '') {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: String(keyword || '').trim()
  });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminFeatureSettingUsage() {
  const { data, error } = await supabase.rpc('get_display_setting_usage');
  if (error) throw error;
  return data ?? [];
}

export async function getPendingSongRequests(keyword = '') {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
    .from('song_requests')
    .select(`
      id,
      requester_id,
      title,
      part,
      proposed_level,
      status,
      created_at,
      request_type,
      current_song_id,
      version_id,
      game_versions!song_requests_version_id_fkey(name),
      profiles!song_requests_requester_id_fkey(username)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1);

    if (keyword.trim()) query = query.ilike('title', `%${keyword.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function approveSongRequest(requestId, level, isHot = false) {
  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel)) throw new Error('難易度を入力してください。');

  const { data, error } = await supabase.rpc('approve_song_request', {
    p_request_id: requestId,
    p_level: Math.round((numericLevel + Number.EPSILON) * 100) / 100,
    p_is_hot: Boolean(isHot)
  });
  if (error) throw error;
  return data;
}

export async function rejectSongRequest(requestId) {
  const { data, error } = await supabase.rpc('reject_song_request', {
    p_request_id: requestId
  });
  if (error) throw error;
  return data;
}

export async function accountAdmin(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('account-admin', {
    body: { action, ...payload }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}


export const MASTER_PARTS = [
  'BSC-D','ADV-D','EXT-D','MAS-D',
  'BSC-G','ADV-G','EXT-G','MAS-G',
  'BSC-B','ADV-B','EXT-B','MAS-B'
];

export async function saveMasterSongRow({
  originalTitle = '',
  title,
  isHot = false,
  levels = {}
}) {
  const cleanTitle = String(title || '').trim();
  const oldTitle = String(originalTitle || '').trim();

  if (!cleanTitle) throw new Error('曲名を入力してください。');

  const filledParts = MASTER_PARTS.filter(part => String(levels[part] ?? '').trim() !== '');
  if (!filledParts.length) throw new Error('少なくとも1つの難易度を入力してください。');

  // 曲名変更
  if (oldTitle && oldTitle !== cleanTitle) {
    const { error: renameError } = await supabase
      .from('songs')
      .update({ title: cleanTitle })
      .eq('title', oldTitle);

    if (renameError) throw renameError;
  }

  const targetTitle = cleanTitle;

  const { data: existing, error: existingError } = await supabase
    .from('songs')
    .select('id,part')
    .eq('title', targetTitle);

  if (existingError) throw existingError;

  const existingByPart = new Map((existing ?? []).map(row => [row.part, row]));

  for (const part of MASTER_PARTS) {
    const raw = String(levels[part] ?? '').trim();
    const current = existingByPart.get(part);

    if (!raw) {
      if (current) {
        const { error } = await supabase.from('songs').delete().eq('id', current.id);
        if (error) throw error;
      }
      continue;
    }

    const level = Number(raw);
    if (!Number.isFinite(level) || level <= 0 || level > 99.99) {
      throw new Error(`${part} の難易度が不正です。`);
    }

    const { error } = await supabase
      .from('songs')
      .upsert({
        is_hot: Boolean(isHot),
        title: targetTitle,
        part,
        level: Math.round((level + Number.EPSILON) * 100) / 100
      }, { onConflict: 'title,part' });

    if (error) throw error;
  }

  const { error: hotError } = await supabase
    .from('songs')
    .update({ is_hot: Boolean(isHot) })
    .eq('title', targetTitle);

  if (hotError) throw hotError;
}

export async function deleteMasterSongTitle(title) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return;

  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('title', cleanTitle);

  if (error) throw error;
}
