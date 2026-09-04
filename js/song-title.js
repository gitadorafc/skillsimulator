// 保存・照合共通。大文字小文字・記号・全角英数字は変更しない。
export function normalizeSongTitle(value) {
  return String(value ?? '')
    .replace(/[ \t\r\n\f\v\u00A0\u3000]+/g, ' ')
    .replace(/^ +| +$/g, '');
}
