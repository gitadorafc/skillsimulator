export function buildSkillShareText(skillLines) {
  // Xの共有画面で末尾のハッシュタグと認識候補が重なって見えないため、
  // ハッシュタグの後に改行を入れてカーソル位置を次の行へ送る。
  return `${skillLines.join('\n')}\n#GITADORASkillSimulator\n`;
}

function downloadSkillShareFiles(files) {
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    setTimeout(() => {
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, index * 180);
  });
}

export async function shareGeneratedSkillFiles(files, skillLines, showDialog) {
  const text = buildSkillShareText(skillLines);

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
      await navigator.share({
        files,
        title: 'GITADORA Skill Simulator',
        text
      });
    } else {
      downloadSkillShareFiles(files);
      const message = files.length === 2
        ? 'GF・DMの共有画像2枚を保存しました。XやInstagramの投稿画面から画像を選択してください。'
        : '画像を保存しました。XやInstagramの投稿画面から画像を選択してください。';
      await showDialog(message, '共有画像');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      await showDialog('共有に失敗しました: ' + error.message, 'エラー');
    }
  }
}
