export function createSiteDialogController(getElement) {
  let resolver = null;
  let confirmMode = false;
  let promptMode = false;

  function showDialog(message, title = 'お知らせ') {
    confirmMode = false;
    promptMode = false;
    getElement('siteDialogInput').classList.add('hidden');
    getElement('siteDialogInput').value = '';
    getElement('siteDialogTitle').textContent = title;
    getElement('siteDialogMessage').textContent = String(message || '');
    getElement('siteDialogOk').textContent = 'OK';
    getElement('siteDialogCancel').classList.add('hidden');
    getElement('siteDialogMask').style.display = 'flex';

    return new Promise(resolve => {
      resolver = resolve;
    });
  }

  function showConfirm(message, title = '確認', confirmText = '削除する') {
    confirmMode = true;
    promptMode = false;
    getElement('siteDialogInput').classList.add('hidden');
    getElement('siteDialogInput').value = '';
    getElement('siteDialogTitle').textContent = title;
    getElement('siteDialogMessage').textContent = String(message || '');
    getElement('siteDialogOk').textContent = confirmText;
    getElement('siteDialogCancel').classList.remove('hidden');
    getElement('siteDialogMask').style.display = 'flex';

    return new Promise(resolve => {
      resolver = resolve;
    });
  }

  function showPrompt(message, title = '入力', confirmText = 'OK', placeholder = '') {
    confirmMode = true;
    promptMode = true;
    getElement('siteDialogTitle').textContent = title;
    getElement('siteDialogMessage').textContent = String(message || '');
    getElement('siteDialogInput').classList.remove('hidden');
    getElement('siteDialogInput').value = '';
    getElement('siteDialogInput').placeholder = placeholder;
    getElement('siteDialogOk').textContent = confirmText;
    getElement('siteDialogCancel').classList.remove('hidden');
    getElement('siteDialogMask').style.display = 'flex';

    setTimeout(() => getElement('siteDialogInput').focus(), 0);

    return new Promise(resolve => {
      resolver = resolve;
    });
  }

  function close(result = true) {
    const promptValue = promptMode ? getElement('siteDialogInput').value : result;
    getElement('siteDialogMask').style.display = 'none';
    getElement('siteDialogCancel').classList.add('hidden');
    getElement('siteDialogInput').classList.add('hidden');
    getElement('siteDialogInput').value = '';
    const resolve = resolver;
    resolver = null;
    const wasPrompt = promptMode;
    confirmMode = false;
    promptMode = false;
    if (resolve) resolve(wasPrompt ? (result ? promptValue : null) : result);
  }

  return {
    showDialog,
    showConfirm,
    showPrompt,
    close,
    isConfirmMode: () => confirmMode
  };
}
