import { supabase } from './supabase.js';

export async function getMyTags() {
  const { data, error } = await supabase
    .from('user_tags')
    .select('id,name,sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getMyScoreTagMap() {
  const { data, error } = await supabase
    .from('user_score_tags')
    .select('user_score_id,tag_id');
  if (error) throw error;

  const result = new Map();
  for (const row of data || []) {
    if (!result.has(row.user_score_id)) result.set(row.user_score_id, new Set());
    result.get(row.user_score_id).add(row.tag_id);
  }
  return result;
}

export async function getMyScoreTagIds(scoreId) {
  if (!scoreId) return [];
  const { data, error } = await supabase
    .from('user_score_tags')
    .select('tag_id')
    .eq('user_score_id', scoreId);
  if (error) throw error;
  return (data || []).map(row => row.tag_id);
}

export async function replaceMyTags(tags) {
  const { data, error } = await supabase.rpc('replace_my_tags', {
    p_tags: tags.map((tag, index) => ({
      id: tag.id || null,
      name: tag.name,
      sort_order: index
    }))
  });
  if (error) throw error;
  return data || [];
}

export async function setMyScoreTags(scoreId, tagIds) {
  const { error } = await supabase.rpc('set_my_score_tags', {
    p_score_id: scoreId,
    p_tag_ids: tagIds
  });
  if (error) throw error;
}
