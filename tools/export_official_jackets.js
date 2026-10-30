/* 公式サイト「曲別成績」ページの開発者コンソールへ貼り付けて実行します。
 * 37カテゴリを順番に取得し、曲名/参照URLをCSVに保存します。
 * 画像そのものはCSVに含めません。ログイン必須URLの有効期間には注意してください。
 */
(async () => {
  const form = document.querySelector('form[name="category"]');
  if (!form || !document.querySelector('.music_table_tb')) {
    console.error('公式の「曲別成績」ページで実行してください。'); return;
  }
  const endpoint = new URL(form.getAttribute('action') || 'music.html', location.href).href;
  const rows = new Map();
  const failures = [];
  const parser = new DOMParser();
  for (let cat=0; cat<=36; cat++) {
    try {
      const params = new URLSearchParams(new FormData(form));
      params.set('cat', String(cat));
      params.set('gtype', 'gf');
      const response = await fetch(endpoint, {method:'POST',credentials:'include',body:params,redirect:'follow'});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const doc = parser.parseFromString(await response.text(), 'text/html');
      const entries = [...doc.querySelectorAll('td.music_cell')];
      if (!entries.length) throw Error('楽曲一覧が取得できません（ログイン状態を確認）');
      for (const cell of entries) {
        const title = cell.querySelector('.title_box a')?.textContent?.trim();
        const img = cell.querySelector('img.jacket');
        if (!title || !img) continue;
        const url = new URL(img.getAttribute('src'), endpoint).href;
        rows.set(title, {title,image_url:url,category:cat});
      }
      console.log(`${cat+1}/37: ${entries.length}曲、累計${rows.size}曲`);
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch(e) {failures.push([cat,String(e)]);console.warn(`カテゴリ${cat}取得失敗`,e);}
  }
  const esc = value => '"'+String(value??'').replace(/"/g,'""')+'"';
  const csv = '\ufefftitle,image_url,category\r\n'+[...rows.values()].map(r => [r.title,r.image_url,r.category].map(esc).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  link.download = 'gitadora_official_jackets.csv';link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  console.log(`CSV出力: ${rows.size}曲。取得に失敗したカテゴリ`, failures);
})();
