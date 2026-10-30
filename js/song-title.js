// 保存・照合共通。大文字小文字・記号・全角英数字は変更しない。
export function normalizeSongTitle(value) {
  return String(value ?? '')
    .replace(/[ \t\r\n\f\v\u00A0\u3000]+/g, ' ')
    .replace(/^ +| +$/g, '');
}

// 曲の照合専用。正式曲名は維持し、波ダッシュ2種だけを同一視する。
// ASCIIの ~ や大小文字は変換しない。
export function normalizeSongTitleForMatch(value) {
  return normalizeSongTitle(value).replace(/\u301C/g, '\uFF5E');
}
