import {
  getFcBadgeMarkup,
  getOptionBadgeMarkup,
  getSongSkillRank
} from './card-renderer.js?v=4_14_34';
import { formatRate, formatSkill } from './scores.js?v=3_18_4';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

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
  return getOptionBadgeMarkup(option) ||
    `<span class="history-option-badge">${escapeHtml(getOptionDisplayName(option, part))}</span>`;
}

function formatOptionPercentage(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export function renderPersonalBest(personalBest, part) {
  if (!personalBest) return '';

  const badges = [
    getFcBadgeMarkup(personalBest.fc, personalBest.achievement_rate),
    getHistoricalOptionMarkup(personalBest.play_option, part)
  ].filter(Boolean).join('');
  const badgesMarkup = badges
    ? `<span class="rate-personal-best-badges">${badges}</span>`
    : '';

  return `
    <div class="rate-personal-best-label">歴代自己ベスト</div>
    <div class="rate-personal-best-detail">
      <strong class="rate-personal-best-value">${formatRate(personalBest.achievement_rate)}%</strong>
      ${badgesMarkup}
      <span class="rate-personal-best-version">(${escapeHtml(personalBest.version_name)})</span>
    </div>`;
}

export function renderOptionSummary(optionRows, part) {
  const rows = Array.isArray(optionRows) ? optionRows : [];
  const isDm = String(part).endsWith('-D');
  const visibleOptions = rows.filter(row => {
    if (Number(row.percentage) <= 0) return false;
    if (isDm) return ['NORMAL', 'BASS_MIRROR'].includes(row.play_option);
    return ['NORMAL', 'RAN', 'SRA', 'RAN+', 'SRA+'].includes(row.play_option);
  });
  const hasBassMirror = isDm && rows.some(row =>
    row.play_option === 'BASS_MIRROR' && Number(row.use_count) > 0
  );
  if (isDm ? !hasBassMirror : visibleOptions.length === 0) return '';

  return `
    <div class="option-share-title">全ユーザーのオプション利用割合</div>
    ${visibleOptions.map(row => `
      <div class="option-share-item">
        <span>${escapeHtml(getOptionDisplayName(row.play_option, part))}</span>
        <strong>${formatOptionPercentage(row.percentage)}%</strong>
      </div>`).join('')}`;
}

export function renderRateComparisonRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '<div class="empty-state">比較できる記録がありません</div>';
  }

  return rows.map(row => {
    const skillClass = `skill-box-${getSongSkillRank(Number(row.skill) || 0)}`;
    return `
      <div class="rate-row ${row.is_self ? 'self' : ''}">
        <div class="rate-user">
          <div class="rate-user-name">${escapeHtml(row.username)}${row.is_self ? '（自分）' : ''}</div>
          <div class="rate-badges">
            ${getFcBadgeMarkup(row.fc, row.achievement_rate)}
            ${getOptionBadgeMarkup(row.play_option)}
          </div>
        </div>
        <div class="rate-value">${formatRate(row.achievement_rate)}%</div>
        <div class="rate-skill ${skillClass}"><span class="dc-skill-value">${formatSkill(row.skill)}</span></div>
      </div>`;
  }).join('');
}
