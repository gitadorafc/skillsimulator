/* Paste into Console on the OFFICIAL music-list page after signing in.
   Images must be accessible in that session. Exports in 100-image gzip chunks.
   Only run/download material whose reuse and publication are permitted. */
(async () => {
  const imgs=[...document.querySelectorAll('img.jacket[alt]')];
  if(!imgs.length){console.error('No img.jacket[alt] elements found. Open the official music-list page.');return;}
  const chunkSize=100;
  async function readImage(img){
    const url=new URL(img.getAttribute('src'),location.href);
    if(url.origin!==location.origin)throw Error('cross-origin image rejected');
    const response=await fetch(url.href,{credentials:'include',cache:'default'});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const blob=await response.blob();
    if(!blob.type.startsWith('image/'))throw Error('response was not an image');
    return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob);});
  }
  async function gzipBlob(payload){
    const stream=new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
  }
  let successful=0,failed=0;
  for(let start=0;start<imgs.length;start+=chunkSize){
    const items=[],errors=[];
    for(const img of imgs.slice(start,start+chunkSize)){
      const title=(img.getAttribute('alt')||'').trim();
      if(!title)continue;
      try{items.push({title,image:await readImage(img)});successful++;}
      catch(err){failed++;errors.push({title,message:String(err)});}
    }
    const blob=await gzipBlob({schema:1,items,errors});
    const anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);
    anchor.download=`official_jackets_${String(start/chunkSize+1).padStart(3,'0')}.json.gz`;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(anchor.href),120000);
    console.log('Exported batch',start/chunkSize+1,'/',Math.ceil(imgs.length/chunkSize),'images',items.length,'errors',errors.length);
  }
  console.log(`Complete. Exported: ${successful}; failed: ${failed}. Browser may ask you to allow multiple downloads.`);
})();
