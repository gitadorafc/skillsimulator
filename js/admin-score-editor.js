// Admin-only score editor. Public nodes and their listeners are restored intact.
// No global style or public markup changes are performed here.

// The score detail editor is available only for the logged-in user's own record.
export function resolveAdminComparisonScoreId({songId, part, editScoreId, scores}) {
  if (!document.body.classList.contains('admin-new-ui')) return editScoreId || null;
  const ownScores = Array.isArray(scores) ? scores : [];
  const requested = editScoreId && ownScores.find(row => String(row.score_id) === String(editScoreId));
  if (requested) return String(requested.score_id);
  const own = ownScores.find(row => String(row.song_id) === String(songId) && String(row.part) === String(part));
  return own ? String(own.score_id) : null;
}
const MOVES = [
  ['title', () => document.getElementById('formTitle')?.closest('.f-group')],
  ['part', () => document.getElementById('partSelect')?.closest('.form-grid-two')],
  ['master', () => document.getElementById('masterRequestArea')],
  ['correction', () => document.getElementById('levelCorrectionArea')],
  ['rate', () => document.getElementById('rateSkillFields')],
  ['extra', () => document.getElementById('scoreExtraFields')],
  ['comment', () => document.getElementById('scorePrivateCommentGroup')],
  ['tags', () => document.getElementById('scoreTagGroup')]
];
let mounted = null;
export function prepareAdminScoreEditor(score = null) {
  const sheet = document.querySelector('#domModal > .mdl-sheet');
  if (!sheet) return;
  if (!document.body.classList.contains('admin-new-ui')) {
    restorePublicScoreEditor();
    return;
  }
  if (!mounted) {
    const template = document.getElementById('adminScoreEditorTemplate');
    const oldFooter = sheet.querySelector(':scope > .btn-block');
    const deleteArea = document.getElementById('editDeleteArea');
    if (!template?.content || !oldFooter || !deleteArea) return;
    const fragment = template.content.cloneNode(true);
    const moved = [];
    // Relocate the nodes, not clones, to retain all user data and event listeners.
    for (const [slot, find] of MOVES) {
      const node = find();
      const destination = fragment.querySelector(`[data-admin-score-slot="${slot}"]`);
      if (!node || !destination) continue;
      const marker = document.createComment('public-score-'+slot);
      node.before(marker);
      moved.push({node, marker});
      destination.append(node);
    }
    const footer = fragment.querySelector('.admin-score-footer');
    const actions = [document.getElementById('btnCancelForm'), deleteArea, document.getElementById('btnSubmitForm')];
    for (const node of actions) {
      const marker = document.createComment('public-score-action');
      node.before(marker);
      moved.push({node, marker});
      footer.append(node);
    }
    const content = fragment.querySelector('.admin-score-editor-content');
    // Append only the two actual nodes; template whitespace must not remain in the public DOM after restoration.
    sheet.append(content, footer);
    const correctionArea = document.getElementById('levelCorrectionArea');
    const correctionLayout = document.createElement('div');
    correctionLayout.className = 'admin-correction-layout';
    correctionLayout.innerHTML = '<div class="admin-correction-copy"></div><div class="admin-correction-field"></div><div class="admin-correction-action"></div>';
    const correctionMoved = [];
    const transfer = (selector, destination) => {
      const node = correctionArea?.querySelector(selector);
      if (!node) return;
      const marker = document.createComment('public-correction-'+selector);
      node.before(marker);
      correctionMoved.push({node, marker});
      destination.append(node);
    };
    const copy = correctionLayout.querySelector('.admin-correction-copy');
    const field = correctionLayout.querySelector('.admin-correction-field');
    const action = correctionLayout.querySelector('.admin-correction-action');
    transfer('.level-correction-title', copy);
    transfer('.level-correction-note', copy);
    transfer('#levelCorrectionForm label', field);
    transfer('#correctionLevel', field);
    transfer('#btnSendLevelCorrection', action);
    correctionArea?.append(correctionLayout);
    sheet.classList.add('admin-score-editor');
    mounted = {sheet, moved, content, footer, correctionLayout, correctionMoved};
  }
  const del = document.getElementById('btnDeleteEditingScore');
  if (del) del.textContent = '削除';
  const submit = document.getElementById('btnSubmitForm');
  if (submit) submit.textContent = '保存';
  const details = mounted.sheet.querySelector('.admin-score-details');
  if (details) details.open = Boolean(
    document.getElementById('formPrivateComment')?.value.trim() ||
    document.querySelector('#scoreTagChoices input:checked')
  );
  const correction = mounted.sheet.querySelector('.admin-score-correction');
  if (correction) correction.open = false;
}
export function restorePublicScoreEditor() {
  if (!mounted) return;
  const {sheet, moved, content, footer, correctionLayout, correctionMoved} = mounted;
  for (const {node, marker} of correctionMoved) {
    marker.before(node);
    marker.remove();
  }
  correctionLayout.remove();
  for (const {node, marker} of moved) {
    marker.before(node);
    marker.remove();
  }
  content.remove();
  footer.remove();
  sheet.classList.remove('admin-score-editor');
  const del = document.getElementById('btnDeleteEditingScore');
  const submit = document.getElementById('btnSubmitForm');
  if (del) del.textContent = '削除';
  if (submit) submit.textContent = '保存';
  mounted = null;
}
