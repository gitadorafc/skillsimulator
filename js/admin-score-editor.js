// GITADORA admin-only registered-score editor. Public editor is never modified
// until admin-new-ui is active. Original nodes are moved (not cloned) so that
// existing handlers and form values survive account changes and modal reopening.
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
let current = null;
export function scoreSubmitLabel(label) {
  if (!document.body.classList.contains('admin-new-ui')) return label;
  return label === '保存する' ? '保存' : label;
}
export function prepareAdminScoreEditor(score = null) {
  const modal = document.getElementById('domModal');
  const sheet = modal?.querySelector('.mdl-sheet');
  const isAdmin = document.body.classList.contains('admin-new-ui');
  if (!sheet) return;
  if (!isAdmin) {
    restorePublicScoreEditor();
    return;
  }
  if (!current) {
    const template = document.getElementById('adminScoreEditorTemplate');
    const footer = sheet.querySelector(':scope > .btn-block');
    const deleteArea = document.getElementById('editDeleteArea');
    if (!template?.content || !footer || !deleteArea) return;
    const fragment = template.content.cloneNode(true);
    const content = fragment.querySelector('.admin-score-editor-content');
    const adminFooter = fragment.querySelector('.admin-score-footer');
    const saved = [];
    for (const [slot, find] of MOVES) {
      const node = find();
      const destination = fragment.querySelector(`[data-admin-score-slot="${slot}"]`);
      if (!node || !destination) continue;
      const marker = document.createComment(`score-public-${slot}`);
      node.parentNode.insertBefore(marker, node);
      saved.push({node, marker});
      destination.appendChild(node);
    }
    for (const node of [document.getElementById('btnCancelForm'), deleteArea, document.getElementById('btnSubmitForm')]) {
      const marker = document.createComment('score-public-action');
      node.parentNode.insertBefore(marker, node);
      saved.push({node, marker});
      adminFooter.appendChild(node);
    }
    sheet.append(fragment);
    sheet.classList.add('admin-score-editor');
    current = {sheet, saved, content, footer:adminFooter};
  }
  const btnDelete = document.getElementById('btnDeleteEditingScore');
  const btnSubmit = document.getElementById('btnSubmitForm');
  if (btnDelete) btnDelete.textContent = '削除';
  if (btnSubmit) btnSubmit.textContent = scoreSubmitLabel(btnSubmit.textContent);
  const comment = document.getElementById('formPrivateComment')?.value.trim();
  const details = current.sheet.querySelector('.admin-score-details');
  // Show existing comments/tags rather than hide data that needs editing.
  if (details) details.open = Boolean(comment);
  const correction = current.sheet.querySelector('.admin-score-correction');
  if (correction) correction.open = false;
}
export function restorePublicScoreEditor() {
  if (!current) return;
  const {sheet, saved, content, footer} = current;
  for (const {node, marker} of saved) {
    if (marker.parentNode) marker.parentNode.insertBefore(node, marker);
    marker.remove();
  }
  content.remove(); footer.remove();
  sheet.classList.remove('admin-score-editor');
  const del = document.getElementById('btnDeleteEditingScore');
  const submit = document.getElementById('btnSubmitForm');
  if (del) del.textContent = 'この登録データを削除';
  if (submit && submit.textContent === '保存') submit.textContent = '保存する';
  current = null;
}
