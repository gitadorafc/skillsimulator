import { formatLevel, formatRate, formatSkill } from './scores.js?v=3_18_4';
import { getSkillColorRowByTotalValue } from './skill-colors.js?v=4_14_33';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function getSongSkillRank(skillValue) {
  // 曲別Skillは×50した値をTOTALスキル帯へ変換し、同じカラーテーブルを使う。
  return getSkillColorRowByTotalValue((Number(skillValue) || 0) * 50).rank;
}

export function getPartColorClass(part) {
  const value = String(part || '');
  if (value.startsWith('MAS')) return 'p-mas';
  if (value.startsWith('EXT')) return 'p-ext';
  if (value.startsWith('ADV')) return 'p-adv';
  if (value.startsWith('BSC')) return 'p-bsc';
  return '';
}

export function getFcBadgeMarkup(fc, achievementRate = null) {
  const rate = Number(achievementRate);
  const value = Number.isFinite(rate) && rate === 100
    ? 'EXC'
    : String(fc || '').toUpperCase();

  if (value !== 'FC' && value !== 'EXC') return '';
  const cls = value === 'EXC' ? 'exc' : 'fc';
  return `<span class="fc-unified-badge ${cls}">${value}</span>`;
}

export function getOptionBadgeMarkup(option) {
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
  return `<span class="opt-badge ${cls}">${escapeHtml(label)}</span>`;
}

function getHotTagMarkup(isHot) {
  return isHot ? '<span class="hot-tag">HOT</span>' : '';
}

export function createCard(record, index, mode = 'MANAGE') {
  const skill = Number(record.skill);
  const fcBadge = getFcBadgeMarkup(record.fc, record.achievement_rate);
  const optionBadge = getOptionBadgeMarkup(record.play_option);
  const hotTag = getHotTagMarkup(record.is_hot);
  const pendingTag = record.pending_master ? '<span class="pending-badge">申請中</span>' : '';

  const songRank = getSongSkillRank(skill);
  const boxColor = `skill-box-${songRank}`;
  const rowColor = `skill-row-${songRank}`;

  const titleMarkup = `${pendingTag}${hotTag}<span class="dc-song-title">${escapeHtml(record.title)}</span>`;
  const partMarkup = `<span class="p-badge ${getPartColorClass(record.part)}">${escapeHtml(record.part)}</span>`;
  const compareAttributes = record.song_id
    ? `data-compare-song="${record.song_id}" data-compare-title="${escapeHtml(record.title)}" data-compare-part="${escapeHtml(record.part)}"`
    : '';

  if (mode === 'SKILL') {
    const editAttribute = record.song_id ? ` data-compare-edit-score="${record.score_id}"` : '';
    return `
      <div class="dc-card dc-card-skill ${rowColor}" ${compareAttributes}${editAttribute}>
        <div class="dc-part">${partMarkup}</div>
        <div class="dc-title smart-song-title" data-full-title="${escapeHtml(record.title)}">${titleMarkup}</div>
        <div class="dc-skill dc-skill-span ${boxColor}"><span class="dc-skill-value">${formatSkill(skill)}</span></div>

        <div class="dc-fc">${fcBadge}</div>
        <div class="dc-lv"><span class="dc-field-label">Lv</span><strong>${formatLevel(record.level)}</strong></div>
        <div class="dc-rate"><span class="dc-field-label">達成率 </span><strong>${formatRate(record.achievement_rate)}%</strong></div>
        <div class="dc-option">${optionBadge}</div>
      </div>`;
  }

  if (mode === 'PUBLIC') {
    return `
      <div class="dc-card dc-card-manage dc-card-public ${rowColor}" ${compareAttributes}>
        <div class="dc-part">${partMarkup}</div>
        <div class="dc-title smart-song-title" data-full-title="${escapeHtml(record.title)}">${titleMarkup}</div>
        <div class="dc-skill dc-skill-span ${boxColor}"><span class="dc-skill-value">${formatSkill(skill)}</span></div>

        <div class="dc-fc">${fcBadge}</div>
        <div class="dc-lv"><span class="dc-field-label">Lv</span><strong>${formatLevel(record.level)}</strong></div>
        <div class="dc-rate"><span class="dc-field-label">達成率 </span><strong>${formatRate(record.achievement_rate)}%</strong></div>
        <div class="dc-option">${optionBadge}</div>
      </div>`;
  }

  return `
    <div class="dc-card dc-card-manage ${rowColor}" ${compareAttributes}>
      <div class="dc-part">${partMarkup}</div>
      <div class="dc-title smart-song-title" data-full-title="${escapeHtml(record.title)}">${titleMarkup}</div>
      <div class="dc-skill ${boxColor}"><span class="dc-skill-value">${formatSkill(skill)}</span></div>

      <div class="dc-fc">${fcBadge}</div>
      <div class="dc-lv">Lv <strong>${formatLevel(record.level)}</strong></div>
      <div class="dc-rate"><span class="dc-field-label">達成率 </span><strong>${formatRate(record.achievement_rate)}%</strong></div>
      <div class="dc-option">${optionBadge}</div>
      <div class="dc-edit"><button class="m-action-btn btn-e" data-edit="${record.score_id}">編集</button></div>
    </div>`;
}
