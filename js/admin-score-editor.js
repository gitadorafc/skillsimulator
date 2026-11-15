// Admin-only score editor. Public nodes and their listeners are restored intact.
// No global style or public markup changes are performed here.
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
export function adminScoreSubmitLabel(publicLabel) {
  return document.body.classList.contains('admin-new-ui') && publicLabel === '保存する'
    ? '保存' : publicLabel;
}
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
    sheet.append(fragment);
    sheet.classList.add('admin-score-editor');
    mounted = {sheet, moved, content, footer};
  }
  const del = document.getElementById('btnDeleteEditingScore');
  if (del) del.textContent = '削除';
  const submit = document.getElementById('btnSubmitForm');
  if (submit?.textContent === '保存する') submit.textContent = '保存';
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
  const {sheet, moved, content, footer} = mounted;
  for (const {node, marker} of moved) {
    marker.before(node);
    marker.remove();
  }
  content.remove();
  footer.remove();
  sheet.classList.remove('admin-score-editor');
  const del = document.getElementById('btnDeleteEditingScore');
  const submit = document.getElementById('btnSubmitForm');
  if (del) del.textContent = 'この登録データを削除';
  if (submit?.textContent === '保存') submit.textContent = '保存する';
  mounted = null;
}
