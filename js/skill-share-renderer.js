import {
  getSkillColorRowByTotalValue,
  skillColorCanvasVerticalPaint,
  skillColorCanvasShareTextPaint,
  drawSkillColorCanvasSparkle,
  drawShareTotalSparkles
} from './skill-colors.js?v=4_14_33';
import { normalizeSongTitleForMatch } from './songs.js?v=4_15_6';

// Keep the public and admin entry points separate. The admin-only jacket
// treatment must never alter ordinary users' exported skill images.
const number = value => Number(value) || 0;
const fixed = value => number(value).toFixed(2);
const rows = (source, key, legacy) => Array.isArray(source?.[key]) ? source[key]
  : Array.isArray(source?.[legacy]) ? source[legacy] : [];
const rankPaint = (ctx, value, left, top, width, height) =>
  skillColorCanvasShareTextPaint(ctx, getSkillColorRowByTotalValue(value), left, top, width, height);

function pill(ctx, text, x, y, w, h, bg, fg = '#fff', border = bg, font = 15) {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.stroke();
  ctx.font = `900 ${font}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(text, x + w / 2, y + h / 2, w - 7);
  ctx.restore();
}
function fitted(ctx, title, width, font) {
  ctx.font = font;
  const original = String(title || '');
  if (ctx.measureText(original).width <= width) return original;
  let value = original;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > width) value = value.slice(0, -1);
  return `${value}…`;
}
const partColor = part => {
  const p = String(part || '').toUpperCase();
  if (p.startsWith('MAS')) return ['#b824d4', '#fff'];
  if (p.startsWith('EXT')) return ['#f43f46', '#fff'];
  if (p.startsWith('ADV')) return ['#eab308', '#101827'];
  return ['#3b9ff2', '#fff'];
};
const sectionColor = section => section === 'HOT'
  ? {bg:'#e94b88', fg:'#0b1020', border:'#be185d'}
  : {bg:'#83c63d', fg:'#0b1020', border:'#5f9423'};
const optionColor = option => ({
  RAN:['#153326','#86efac','#15803d'], 'RAN+':['#123340','#67e8f9','#0369a1'],
  SRA:['#302017','#fdba74','#c2410c'], 'SRA+':['#361b29','#fecdd3','#be123c'],
  BASS_MIRROR:['#302044','#c4b5fd','#7c3aed']
})[option] || ['#1e293b','#cbd5e1','#475569'];

async function loadJackets(allRows, getJacketUrls) {
  const map = new Map();
  if (typeof getJacketUrls !== 'function') return map;
  const unique = [...new Set(allRows.map(r => String(r?.title || '')).filter(Boolean))];
  await Promise.all(unique.map(async title => {
    const urls = getJacketUrls(title);
    for (const url of Array.isArray(urls) ? urls : []) {
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
        map.set(normalizeSongTitleForMatch(title), image);
        break;
      } catch (_) { /* Fall back to another image or the placeholder. */ }
    }
  }));
  return map;
}
function drawJacket(ctx, image, x, y, size) {
  ctx.fillStyle = '#263953';
  ctx.fillRect(x, y, size, size);
  if (!image) {
    ctx.fillStyle = '#8396b0';
    ctx.font = `900 ${Math.round(size / 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♫', x + size/2, y + size/2);
    return;
  }
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const square = Math.min(w,h);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x,y,size,size,5);
  ctx.clip();
  ctx.drawImage(image, (w-square)/2,(h-square)/2,square,square,x,y,size,size);
  ctx.restore();
}
function drawSkill(ctx, value, x, y, w, h, compare = false) {
  const skill = number(value);
  const rank = getSkillColorRowByTotalValue(skill * 50);
  ctx.fillStyle = '#0b1424';
  ctx.fillRect(x,y,w,h);
  for (const bx of [x, x+w-5]) {
    ctx.fillStyle = rankPaint(ctx, skill*50, bx, y, 5,h);
    ctx.fillRect(bx,y,5,h);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${compare ? 19 : 22}px sans-serif`;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(fixed(skill),x+w-11,y+h/2);
  if (rank.rank === 'sparkle-rainbow') {
    drawSkillColorCanvasSparkle(ctx,x+4,y+7,2.8,'#ffffff');
    drawSkillColorCanvasSparkle(ctx,x+w-4,y+h-7,2.8,'#fff7c2');
  }
}
function drawDetail(ctx, record, x, y, maxX, compact = false) {
  if (!record) {
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 17px sans-serif';
    ctx.fillText('対象外',x,y+12);
    return;
  }
  const part = String(record.part || '').toUpperCase();
  const opt = String(record.play_option || 'NORMAL').toUpperCase();
  const [partBg,partFg] = partColor(part);
  const badgeW = compact ? 62 : 72;
  pill(ctx,part,x,y,badgeW,24,partBg,partFg,partBg,13);
  ctx.fillStyle='#dbe6f3';
  ctx.font=`800 ${compact ? 16 : 18}px sans-serif`;
  ctx.textBaseline='middle';
  ctx.textAlign='left';
  let at=x+badgeW+10;
  ctx.fillText(fixed(record.level),at,y+12);
  at+=compact?53:63;
  ctx.fillText(`${fixed(record.achievement_rate)}%`,at,y+12);
  at+=compact?80:95;
  const medal = number(record.achievement_rate)>=100 ? 'EXC' : String(record.fc||'').toUpperCase()==='FC'?'FC':'';
  if (medal) {
    pill(ctx,medal,at,y+1,compact?43:48,22,medal==='EXC'?'#f6ce54':'#374d76',medal==='EXC'?'#1c2334':'#fff',undefined,12);
  }
  at+=compact?50:58;
  if (opt !== 'NORMAL' && (part.endsWith('-D') ? opt==='BASS_MIRROR' : true) && at+51 <= maxX) {
    pill(ctx,opt==='BASS_MIRROR'?'B-MIR':opt,at,y+1,51,22,...optionColor(opt),12);
  }
}

async function render(data, admin = false) {
  const {
    instrument, snapshot = null, comparisonBaseline = null, currentTotals,
    currentVersionName = '', username = '', getJacketUrls
  } = data;
  const validSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
  const target = validSnapshot || currentTotals || {};
  const hot = rows(target,'hotRows','hot_rows');
  const other = rows(target,'otherRows','other_rows');
  const comparing = !!comparisonBaseline;
  const previousHot = rows(comparisonBaseline,'hotRows','hot_rows');
  const previousOther = rows(comparisonBaseline,'otherRows','other_rows');
  const entries = [...hot.map(row=>({row,section:'HOT'})),...other.map(row=>({row,section:'OTHER'}))];
  const prior = new Map([...previousHot,...previousOther].map(row=>[`${normalizeSongTitleForMatch(row.title)}|${row.part}`,row]));
  const comparisonEntries = entries.filter(({row})=> {
    const p = prior.get(`${normalizeSongTitleForMatch(row.title)}|${row.part}`);
    return !p || number(row.skill)>number(p.skill)+0.004;
  });
  const W=1400;
  const tableY=270;
  const cardH=admin?88:62;
  const compareH=admin?128:103;
  const lineH=comparing?compareH:cardH;
  const gapY=admin?6:4;
  const contentRows=comparing?comparisonEntries.length:Math.max(hot.length,other.length);
  const H=Math.max(comparing?650:950,tableY+74+contentRows*(lineH+gapY)+100);
  const canvas=document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  if (!ctx) throw new Error('画像生成用のCanvasを取得できません。');
  ctx.fillStyle='#07101d';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0f1a2d';ctx.fillRect(28,28,W-56,H-56);
  ctx.fillStyle='#f8fafc';ctx.font='900 42px sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.fillText(instrument==='GF'?'GITADORA GuitarFreaks Skill':'GITADORA DrumMania Skill',54,82);
  ctx.fillStyle='#94a3b8';ctx.font='700 24px sans-serif';
  ctx.fillText(validSnapshot?.versionName||currentVersionName,54,118);
  const name=String(validSnapshot?.username||username).trim()||'USER';
  const nameFont='900 42px sans-serif';
  const displayName=fitted(ctx,name,700,nameFont);
  const nameW=ctx.measureText(displayName).width;
  const total=fixed(target.total);
  const totalX=54+nameW+28;
  const totalW=ctx.measureText(total).width;
  ctx.fillStyle=rankPaint(ctx,target.total,54,132,nameW,52);
  ctx.fillText(displayName,54,174);
  ctx.fillStyle=rankPaint(ctx,target.total,totalX,132,totalW,52);
  ctx.fillText(total,totalX,174);
  drawShareTotalSparkles(ctx,getSkillColorRowByTotalValue(target.total),54,nameW,totalX,totalW,132,52);
  ctx.fillStyle='#94a3b8';ctx.font='800 26px sans-serif';
  ctx.fillText(`HOT ${fixed(target.hot)}   OTHER ${fixed(target.other)}`,54,220);
  const jackets = admin ? await loadJackets((comparing?comparisonEntries:entries).map(x=>x.row),getJacketUrls) : new Map();
  const getImage = r => jackets.get(normalizeSongTitleForMatch(r?.title));
  if (comparing) {
    ctx.fillStyle='#253449';ctx.fillRect(54,tableY,W-108,45);
    ctx.fillStyle='#f8fafc';ctx.font='900 23px sans-serif';ctx.textBaseline='middle';
    ctx.fillText(`スキル更新曲  ${comparisonEntries.length}曲`,70,tableY+23);
    comparisonEntries.forEach(({row,section},index)=>{
      const x=54,y=tableY+53+index*(compareH+gapY),w=W-108;
      const priorRow=prior.get(`${normalizeSongTitleForMatch(row.title)}|${row.part}`);
      ctx.fillStyle=index%2?'#0e192a':'#142137';ctx.fillRect(x,y,w,compareH);
      ctx.strokeStyle='#60758e';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,compareH-2);
      const contentX=x+(admin?110:17);
      if(admin) drawJacket(ctx,getImage(row),x+13,y+24,76);
      const title=fitted(ctx,row.title,795,'900 23px sans-serif');
      ctx.fillStyle='#f8fafc';ctx.font='900 23px sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';
      ctx.fillText(title,contentX,y+21);
      const badgeX=Math.min(contentX+ctx.measureText(title).width+13,x+w-270);
      const sc=sectionColor(section);
      pill(ctx,section,badgeX,y+9,73,23,sc.bg,sc.fg,sc.border,13);
      const skillX=x+w-205;
      ctx.font='900 17px sans-serif';ctx.fillStyle='#f8fafc';ctx.fillText('現在',contentX,y+53);
      ctx.fillStyle='#9baec3';ctx.fillText('前回',contentX,y+86);
      drawDetail(ctx,row,contentX+54,y+41,skillX-8,true);
      drawDetail(ctx,priorRow,contentX+54,y+74,skillX-8,true);
      drawSkill(ctx,row.skill,skillX,y+41,117,27,true);
      if(priorRow) drawSkill(ctx,priorRow.skill,skillX,y+74,117,27,true);
      ctx.font='900 16px sans-serif';ctx.textAlign='left';ctx.fillStyle='#fdba74';
      if(!priorRow) ctx.fillText('NEW',skillX+126,y+55);
      else {
        const delta=number(row.skill)-number(priorRow.skill);
        if(Math.abs(delta)>=.005) {
          ctx.fillStyle=delta>0?'#60a5fa':'#fca5a5';
          ctx.fillText(`${delta>0?'+':''}${delta.toFixed(2)}`,skillX+126,y+55);
        }
      }
    });
    if(!comparisonEntries.length){ctx.textAlign='center';ctx.font='700 23px sans-serif';ctx.fillStyle='#cbd5e1';ctx.fillText('スキル値が上昇した曲・新規対象入りした曲はありません',W/2,tableY+160);}
  } else {
    const colW=630, colGap=32;
    const drawColumn=(section,list,x)=>{
      const sc=sectionColor(section);
      ctx.fillStyle=sc.bg;ctx.fillRect(x,tableY,colW,46);
      ctx.fillStyle=sc.fg;ctx.font='900 25px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(`${section} TOP 25`,x+16,tableY+23);
      list.forEach((row,index)=>{
        const y=tableY+53+index*(cardH+gapY);
        ctx.fillStyle=index%2?'#0d1729':'#152238';ctx.fillRect(x,y,colW,cardH);
        ctx.strokeStyle=skillColorCanvasVerticalPaint(ctx,getSkillColorRowByTotalValue(number(row.skill)*50),x,y,colW,cardH);
        ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,colW-2,cardH-2);
        ctx.fillStyle='#9baec3';ctx.font='800 18px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(String(index+1).padStart(2,'0'),x+10,y+19);
        const artSize=admin?62:0;
        const titleX=x+(admin?99:45);
        if(admin) drawJacket(ctx,getImage(row),x+31,y+11,artSize);
        const title=fitted(ctx,row.title,colW-(titleX-x)-125,'900 19px sans-serif');
        ctx.font='900 19px sans-serif';ctx.fillStyle='#f8fafc';ctx.fillText(title,titleX,y+(admin?24:18));
        drawDetail(ctx,row,titleX,y+(admin?47:31),x+colW-112,true);
        drawSkill(ctx,row.skill,x+colW-113,y+(admin?34:17),103,28);
      });
    };
    drawColumn('HOT',hot,54);
    drawColumn('OTHER',other,54+colW+colGap);
  }
  ctx.fillStyle='#0b1424';ctx.fillRect(54,H-63,W-108,32);
  ctx.fillStyle='#94a3b8';ctx.font='700 23px sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.fillText('GITADORA Skill Simulator',64,H-47);
  ctx.textAlign='right';
  const date=new Date(validSnapshot?.savedAt||Date.now());
  ctx.fillText(Number.isNaN(date.getTime())?'':date.toLocaleDateString('ja-JP'),W-64,H-47);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('共有画像の生成に失敗しました。')),'image/png'));
  return new File([blob],`GITADORA_${instrument}_skill.png`,{type:'image/png'});
}

export async function renderSkillShareFile(data) {
  return render(data,false);
}

export async function renderAdminJacketSkillShareFile(data) {
  return renderAdminLegacy(data);
}

// Admin-specific legacy layout. Keep this drawing pipeline independent of the
// ordinary user's share image; its geometry follows the pre-4.40.89 exports.
async function renderAdminLegacy(data) {
  const {instrument,snapshot=null,comparisonBaseline=null,currentTotals,currentVersionName='',username='',getJacketUrls,getMedalSvg} = data;
  const snap = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
  const target = snap || currentTotals || {};
  const hot = rows(target,'hotRows','hot_rows');
  const other = rows(target,'otherRows','other_rows');
  const comparing = Boolean(comparisonBaseline);
  const priorRows = [...rows(comparisonBaseline,'hotRows','hot_rows'),...rows(comparisonBaseline,'otherRows','other_rows')];
  const key = r => `${normalizeSongTitleForMatch(r?.title)}|${r?.part||''}`;
  const prior = new Map(priorRows.map(r=>[key(r),r]));
  const all = [...hot.map(row=>({row,section:'HOT'})),...other.map(row=>({row,section:'OTHER'}))];
  const updated = all.filter(({row})=>{const p=prior.get(key(row));return !p || number(row.skill)>number(p.skill)+0.004;})
    .sort((a,b)=>(a.section==='OTHER'?0:1)-(b.section==='OTHER'?0:1) || number(b.row.skill)-number(a.row.skill));
  // Use the original export dimensions (1400 logical units, PNG at 1.5x).
  const W=1400, H=comparing?Math.max(1268,540+updated.length*150):2180, scale=1.5;
  const canvas=document.createElement('canvas');canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvasの取得に失敗しました。');
  ctx.scale(scale,scale);
  ctx.fillStyle='#07101d';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0f1a2d';ctx.fillRect(28,28,W-56,H-56);
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#f8fafc';ctx.font='900 42px sans-serif';
  ctx.fillText(instrument==='GF'?'GITADORA GuitarFreaks Skill':'GITADORA DrumMania Skill',54,82);
  ctx.fillStyle='#94a3b8';ctx.font='700 24px sans-serif';ctx.fillText(snap?.versionName||currentVersionName,54,118);
  const uname=String(snap?.username||username).trim()||'USER';
  const display=fitted(ctx,uname,700,'900 42px sans-serif');
  const nw=ctx.measureText(display).width, skill=fixed(target.total), sx=54+nw+28, sw=ctx.measureText(skill).width;
  ctx.fillStyle=rankPaint(ctx,target.total,54,132,nw,52);ctx.fillText(display,54,174);
  ctx.fillStyle=rankPaint(ctx,target.total,sx,132,sw,52);ctx.fillText(skill,sx,174);
  drawShareTotalSparkles(ctx,getSkillColorRowByTotalValue(target.total),54,nw,sx,sw,132,52);
  ctx.fillStyle='#94a3b8';ctx.font='800 26px sans-serif';ctx.fillText(`HOT ${fixed(target.hot)}   OTHER ${fixed(target.other)}`,54,220);
  const jackets=await loadJackets([...all.map(v=>v.row),...priorRows],getJacketUrls);
  const imageOf=r=>jackets.get(normalizeSongTitleForMatch(r?.title));
  const medalCache=new Map();
  if(typeof getMedalSvg==='function'){
    for(const type of ['EXC','FC']){
      try {
        const svg=getMedalSvg(type);
        const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
        try {const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});medalCache.set(type,image);}finally{URL.revokeObjectURL(url);}
      } catch (_) { /* Emoji fallback below */ }
    }
  }
  const badge=(name,x,y,w,h,kind)=>{
    const pal=kind==='HOT'?['#e94b88','#081221','#be185d']:kind==='OTHER'?['#83c63d','#081221','#659a25']:null;
    if(pal)pill(ctx,name,x,y,w,h,...pal,13);
  };
  const medal=(record,x,y,size=26)=>{
    const type=number(record?.achievement_rate)>=99.995?'EXC':String(record?.fc||'').toUpperCase()==='FC'?'FC':null;
    if(!type)return;
    const im=medalCache.get(type);
    if(im)ctx.drawImage(im,x,y,size,size);
    else {ctx.textAlign='center';ctx.font=`${size}px sans-serif`;ctx.textBaseline='middle';ctx.fillStyle='#f8ce54';ctx.fillText('🏅',x+size/2,y+size/2);ctx.textAlign='left';}
  };
  const detail=(record,x,y,allowMedal=true)=>{
    if(!record){ctx.fillStyle='#94a3b8';ctx.font='700 18px sans-serif';ctx.fillText('—',x,y+18);return;}
    const part=String(record.part||'').toUpperCase(),[pbg,pfg]=partColor(part);
    pill(ctx,part,x,y,72,25,pbg,pfg,pbg,13);
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#e2e8f0';ctx.font='800 18px sans-serif';
    ctx.fillText(fixed(record.level),x+90,y+12);
    ctx.fillText(`${fixed(record.achievement_rate)}%`,x+165,y+12);
    if(allowMedal)medal(record,x+265,y,25);
    const opt=String(record.play_option||'NORMAL').toUpperCase();
    if(opt!=='NORMAL'&&(!part.endsWith('-D')||opt==='BASS_MIRROR'))pill(ctx,opt==='BASS_MIRROR'?'B-MIR':opt,x+303,y+1,61,23,...optionColor(opt),13);
  };
  const skillText=(value,x,y)=>{ctx.fillStyle='#f8fafc';ctx.font='900 23px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(fixed(value),x,y);};
  if(comparing){
    // The old image includes the two-row summary above the comparison list.
    const tx=54,tw=W-108;
    ctx.fillStyle='#18283e';ctx.fillRect(tx,238,tw,91);
    const positions=[{x:74,t:'区分'},{x:244,t:'日時'},{x:623,t:'スキル値'},{x:809,t:'上昇値'}];
    ctx.textBaseline='middle';ctx.textAlign='left';ctx.font='800 19px sans-serif';ctx.fillStyle='#94a3b8';
    positions.forEach(p=>ctx.fillText(p.t,p.x,254));
    const dateText=v=>{const dt=new Date(v||Date.now());if(Number.isNaN(dt.getTime()))return '—';return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;};
    ctx.fillStyle='#f8fafc';ctx.font='800 20px sans-serif';
    ctx.fillText('現在',74,280);ctx.fillText('前回',74,309);
    ctx.fillText(dateText(snap?.savedAt),244,280);ctx.fillText(dateText(comparisonBaseline?.savedAt),244,309);
    ctx.fillText(fixed(target.total),623,280);ctx.fillText(fixed(comparisonBaseline?.total),623,309);
    const totalDelta=number(target.total)-number(comparisonBaseline?.total);
    ctx.fillStyle='#60a5fa';ctx.fillText(`${totalDelta>=0?'+':''}${fixed(totalDelta)}`,809,280);
    ctx.fillStyle='#253449';ctx.fillRect(tx,346,tw,44);
    ctx.fillStyle='#f8fafc';ctx.font='900 23px sans-serif';ctx.fillText(`スキル更新曲  ${updated.length}曲`,70,368);
    const cH=144,gap=9,start=399;
    updated.forEach(({row,section},index)=>{
      const y=start+index*(cH+gap),x=tx,w=tw,pre=prior.get(key(row));
      ctx.fillStyle=index%2?'#0d1729':'#142137';ctx.fillRect(x,y,w,cH);
      ctx.strokeStyle='#63758f';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,cH-2);
      drawJacket(ctx,imageOf(row),x+13,y+24,102);
      const contentX=x+127, skillX=x+w-193;
      ctx.fillStyle='#f8fafc';ctx.font='900 24px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(fitted(ctx,row.title,630,'900 24px sans-serif'),contentX,y+28);
      badge(section,x+w-347,y+13,78,25,section);
      ctx.font='900 18px sans-serif';ctx.fillStyle='#f8fafc';ctx.fillText('現在',contentX,y+71);
      ctx.fillStyle='#94a3b8';ctx.fillText('前回',contentX,y+112);
      detail(row,contentX+70,y+57);detail(pre,contentX+70,y+98);
      skillText(row.skill,x+w-112,y+71);
      if(pre)skillText(pre.skill,x+w-112,y+112);
      const delta=number(row.skill)-number(pre?.skill);
      ctx.textAlign='left';ctx.font='900 18px sans-serif';ctx.fillStyle='#60a5fa';
      ctx.fillText(pre?`${delta>=0?'+':''}${fixed(delta)}`:'NEW',x+w-78,y+71);
    });
  }else{
    const top=240,colW=630,colGap=32,start=294,cardH=61,cardGap=4;
    const drawColumn=(section,list,x)=>{
      const color=sectionColor(section);
      ctx.fillStyle=color.bg;ctx.fillRect(x,top,colW,42);
      ctx.fillStyle=color.fg;ctx.font='900 23px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(`${section} TOP 25`,x+10,top+21);
      list.forEach((row,index)=>{
        const y=start+index*(cardH+cardGap);
        ctx.fillStyle=index%2?'#0d1729':'#152238';ctx.fillRect(x,y,colW,cardH);
        ctx.strokeStyle=skillColorCanvasVerticalPaint(ctx,getSkillColorRowByTotalValue(number(row.skill)*50),x,y,colW,cardH);
        ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,colW-2,cardH-2);
        drawJacket(ctx,imageOf(row),x+6,y+5,51);
        const titleX=x+65;
        ctx.font='900 18px sans-serif';ctx.fillStyle='#f8fafc';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(fitted(ctx,row.title,390,'900 18px sans-serif'),titleX,y+20);
        detail(row,titleX,y+33);
        drawSkill(ctx,row.skill,x+colW-106,y+15,96,32);
      });
    };
    drawColumn('HOT',hot,54);drawColumn('OTHER',other,54+colW+colGap);
  }
  ctx.fillStyle='#0b1424';ctx.fillRect(54,H-63,W-108,32);
  ctx.fillStyle='#94a3b8';ctx.font='700 23px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillText('GITADORA Skill Simulator',64,H-47);ctx.textAlign='right';
  const date=new Date(snap?.savedAt||Date.now());ctx.fillText(Number.isNaN(date.getTime())?'':date.toLocaleDateString('ja-JP'),W-64,H-47);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('共有画像の生成に失敗しました。')),'image/png'));
  return new File([blob],`GITADORA_${instrument}_skill.png`,{type:'image/png'});
}
