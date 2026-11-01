#!/usr/bin/env python3
"""Exported official jacket images + Supabase public storage -> optimized Pages assets.
Only process images whose redistribution has been authorized. No database writes.
"""
import argparse, base64, csv, gzip, hashlib, io, json, pathlib, re, sys, unicodedata, urllib.parse, urllib.request
from PIL import Image, UnidentifiedImageError

def norm(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(s or '')).replace('\u301c','\uff5e')).strip()

def safe_url(url, project):
    u=urllib.parse.urlparse(url)
    p=urllib.parse.urlparse(project)
    return u.scheme=='https' and u.hostname==p.hostname and u.path.startswith('/storage/v1/object/public/song-jackets/')

def image_webp(blob):
    im=Image.open(io.BytesIO(blob))
    im.load()
    if im.width<1 or im.height<1 or im.width*im.height>18_000_000: raise ValueError('invalid image size')
    if im.mode not in ('RGB','RGBA'): im=im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
    im.thumbnail((256,256),Image.Resampling.LANCZOS)
    buf=io.BytesIO()
    im.save(buf,'WEBP',quality=82,method=6)
    return buf.getvalue()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--official-dir',type=pathlib.Path,help='Folder containing official_jackets_*.json.gz exports')
    ap.add_argument('--csv',type=pathlib.Path,help='Supabase song_jackets CSV export (title,image_url,storage_path)')
    ap.add_argument('--supabase-url',help='Public Supabase project URL (for PUBLIC song-jackets bucket only)')
    ap.add_argument('--output',type=pathlib.Path,required=True,help='Assets folder, e.g. assets/jackets')
    args=ap.parse_args()
    if not args.official_dir and not args.csv: ap.error('Provide --official-dir and/or --csv')
    image_data={}; source={}; errors=[]
    if args.official_dir:
        for file in sorted(args.official_dir.glob('official_jackets_*.json.gz')):
            with gzip.open(file,'rt',encoding='utf-8') as f:
                doc=json.load(f)
            for row in doc.get('items',[]):
                title=norm(row.get('title'))
                if not title or title in image_data: continue
                try:
                    mime,data_url=row['image'].split(',',1)
                    if not mime.startswith('data:image/'): raise ValueError('not image data')
                    image_data[title]=base64.b64decode(data_url,validate=True)
                    source[title]='official-browser-export'
                except (KeyError,ValueError) as e: errors.append([title,str(e)])
    if args.csv:
        with args.csv.open(encoding='utf-8-sig',newline='') as f:
            rows=list(csv.DictReader(f))
        for row in rows:
            title=norm(row.get('title'))
            path=(row.get('storage_path') or '').strip()
            if not title or not path: continue
            if not args.supabase_url:
                errors.append([title,'storage_path present; supply --supabase-url to retrieve public Storage image'])
                continue
            project=args.supabase_url.rstrip('/')
            url=f'{project}/storage/v1/object/public/song-jackets/{urllib.parse.quote(path,safe="/")}'
            if not safe_url(url,project):
                errors.append([title,'Storage URL validation failed']); continue
            try:
                request=urllib.request.Request(url,headers={'User-Agent':'GITADORA-Jacket-Migration/1.0'})
                with urllib.request.urlopen(request,timeout=20) as response:
                    if not response.headers.get('Content-Type','').startswith('image/'):
                        raise ValueError('Storage response is not an image')
                    blob=response.read(2_500_001)
                    if len(blob)>2_500_000: raise ValueError('image too large')
                image_data[title]=blob  # Uploaded images override official URL exports
                source[title]='supabase-storage'
            except Exception as e: errors.append([title,f'Storage image request failed: {e}'])
    args.output.mkdir(parents=True,exist_ok=True)
    manifest={}; files={}
    for title,blob in image_data.items():
        try:
            compressed=image_webp(blob)
            name=hashlib.sha256(compressed).hexdigest()[:24]+'.webp'
            if name not in files: (args.output/name).write_bytes(compressed);files[name]=True
            manifest[title]=name
        except (OSError,ValueError,UnidentifiedImageError) as e: errors.append([title,f'Image conversion failed: {e}'])
    (args.output/'manifest.json').write_text(json.dumps({'schema':1,'titles':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report={'mapped_titles':len(manifest),'unique_files':len(files),'bytes':sum((args.output/f).stat().st_size for f in files),'source_counts':{k:sum(v==k for v in source.values()) for k in set(source.values())},'errors':errors}
    (args.output/'migration-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Mapped:',len(manifest),'Images:',len(files),'Bytes:',report['bytes'],'Errors:',len(errors))
    print('See migration-report.json; do not delete original Supabase files or rows.')
if __name__=='__main__': main()
