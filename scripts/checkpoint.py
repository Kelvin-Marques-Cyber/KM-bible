"""Create a numbered full project ZIP or a small source checkpoint."""
import argparse,hashlib,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('version');p.add_argument('--source-only',action='store_true');a=p.parse_args()
r=Path(__file__).resolve().parents[1];out=r.parent/f'Biblia-Reformada-{a.version}{"-fontes" if a.source_only else ""}.zip'
excluded={'build','.dart_tool','.git','content_sources','.gradle','Pods','ephemeral','.symlinks','.cxx','.rsync-tmp','__pycache__'}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(r.rglob('*')):
  rel=f.relative_to(r)
  if f.name.endswith('.original.glb'):continue
  if not f.is_file() or any(part in excluded for part in rel.parts):continue
  if 'private' in rel.parts and f.name!='.keep':continue
  if f.suffix in {'.jks','.keystore'} or f.name in {'key.properties','local.properties'}:continue
  if a.source_only and (rel.parts[0]=='native' or f.suffix in {'.sqlite','.ttf','.cact','.glb'}):continue
  z.write(f,'biblia-reformada/'+str(rel))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 print(json.dumps({'file':str(out),'bytes':out.stat().st_size,'files':len(z.namelist()),'sha256':hashlib.file_digest(out.open('rb'),'sha256').hexdigest()}))
