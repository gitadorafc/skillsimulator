const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

export function renderPartOptions(parts, instrument) {
  const optionHtml = part => `<option value="${part}">${part}</option>`;
  if (instrument === 'DM') return parts.map(optionHtml).join('');

  return `
    <optgroup label="-GUITAR-">
      ${parts.filter(part => part.endsWith('-G')).map(optionHtml).join('')}
    </optgroup>
    <optgroup label="-BASS-">
      ${parts.filter(part => part.endsWith('-B')).map(optionHtml).join('')}
    </optgroup>`;
}

export function renderSongSuggestions(rows, title, exactCurrentSong) {
    // 完全一致する曲名は候補の先頭へ。
    const sortedRows = [...(rows ?? [])].sort((a, b) => {
      const aExact = String(a.title || '') === title ? 1 : 0;
      const bExact = String(b.title || '') === title ? 1 : 0;
      return bExact - aExact;
    });

    const suggestionHtml = sortedRows.map(r => `
      <button class="suggestion"
        data-title="${esc(r.title)}"
        data-is-hot="${r.is_hot ? '1':'0'}">
        <span>${r.is_hot ? '[HOT] ' : ''}${esc(r.title)}</span>
      </button>`).join('');

    // 現在の「曲名 + Part」がマスターに完全一致している場合は
    // 新規登録依頼を絶対に表示しない。
    const requestHtml = exactCurrentSong ? '' : `
      <button class="suggestion request-suggestion"
        data-request-title="${esc(title)}">
        <span>＋「${esc(title)}」を曲マスターへ登録依頼</span>
      </button>`;

    return suggestionHtml + requestHtml;
}

