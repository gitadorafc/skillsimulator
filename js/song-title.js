// 保存・照合共通。大文字小文字・記号・全角英数字は変更しない。
export function normalizeSongTitle(value) {
  return String(value ?? '')
    .replace(/[ \t\r\n\f\v\u00A0\u3000]+/g, ' ')
    .replace(/^ +| +$/g, '')
    .replace(/\u301C/g, '\uFF5E');
}

// 曲の照合専用。保存名も波ダッシュを統一し、波ダッシュ2種だけを同一視する。
// ASCIIの ~ や大小文字は変換しない。
export function normalizeSongTitleForMatch(value) {
  const title = normalizeSongTitle(value);
  // 個別に確認済みの公式曲名変更のみ共通の照合名へ寄せる。
  // 他の「(GITADORA ver.)」や大文字小文字、CLASSICには適用しない。
  if (title === 'Shooting Star (GITADORA ver.)') return 'Shooting Star';
  return title;
}
