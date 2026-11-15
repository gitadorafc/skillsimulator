// Admin-only navigation state. The public menu and its handlers are unchanged.
const ADMIN_BACK_IDS = new Set([
  'btnCloseMypage', 'btnCloseFeatureSettings', 'btnCloseTagSettings',
  'btnCloseSkillSync', 'btnCloseAllScoreSync', 'btnCloseSkillShare',
  'btnCloseSkillHistory', 'btnCloseSkillRanking', 'btnCloseOfficialSkillRanking',
  'btnCloseRivalManage', 'btnCloseSongCatalog', 'btnCloseHowTo',
  'btnCloseFeedback', 'btnCloseSupport'
]);

export function installAdminMenuBackReset(clearSelection) {
  document.addEventListener('click', event => {
    if (!document.body.classList.contains('admin-new-ui') ||
        !window.matchMedia('(min-width:1100px)').matches) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || !ADMIN_BACK_IDS.has(button.id)) return;
    // A return/back action is not a selected destination. Never leave the
    // previous sidebar entry highlighted after its workspace is dismissed.
    clearSelection();
  }, true);
}

export function isAdminConfirmedSongPartChange(selectedSong, typedTitle) {
  return document.body.classList.contains('admin-new-ui') &&
    Boolean(selectedSong && typedTitle.trim() === selectedSong.title);
}
