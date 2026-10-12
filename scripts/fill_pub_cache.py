"""Download exact, hash-verified packages from pub.dev for reproducible offline builds."""
import concurrent.futures,hashlib,json,os,tarfile,urllib.request,io
from pathlib import Path
import yaml
lock=yaml.safe_load(Path('pubspec.lock').read_text())['packages'];cache=Path(os.environ.get('PUB_CACHE',str(Path.home()/'.pub-cache')));host=cache/'hosted/pub.dev';host.mkdir(parents=True,exist_ok=True)
items=[(name,data['version'],data['description']['sha256']) for name,data in lock.items() if data['source']=='hosted' and not (host/f"{name}-{data['version']}/pubspec.yaml").exists()]
def fetch(item):
 name,version,sha=item;url=f'https://pub.dev/api/archives/{name}-{version}.tar.gz'
 for attempt in range(3):
  try:
   b=urllib.request.urlopen(url,timeout=60).read()
   if hashlib.sha256(b).hexdigest()!=sha:raise ValueError('hash '+name)
   target=host/f'{name}-{version}';target.mkdir(exist_ok=True)
   with tarfile.open(fileobj=io.BytesIO(b),mode='r:gz') as t:t.extractall(target,filter='data')
   h=cache/'hosted-hashes/pub.dev';h.mkdir(parents=True,exist_ok=True);(h/f'{name}-{version}.sha256').write_text(sha)
   # Pub's offline resolver reads the downloaded package's pubspec directly.
   print('cached',name,version,flush=True);return
  except Exception:
   if attempt==2:raise
print('missing packages',len(items),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(fetch,items))
