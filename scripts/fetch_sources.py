import concurrent.futures,hashlib,json,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'content_sources';DEST.mkdir(exist_ok=True)
sources={
 'bln4.zip':'https://github.com/blivre/BibliaLivre/releases/download/2018.2.0/bliv-n4_vpl.zip',
 'bltr.zip':'https://github.com/blivre/BibliaLivre/releases/download/2018.2.0/bliv-tr_vpl.zip',
 'blivre-license.md':'https://raw.githubusercontent.com/blivre/BibliaLivre/2018.2.0/LICENCA.md',
 'blivre-credits.md':'https://raw.githubusercontent.com/blivre/BibliaLivre/2018.2.0/Contribuidores.md',
 **{f'{n}.zip':f'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/{n}.zip' for n in ['ASV','SpaRV','WLC','TR','MHCC','Barnes']},
 'creeds.xml':'https://www.ccel.org/ccel/schaff/creeds3.xml','wsc.html':'https://www.opc.org/sc.html','wlc.html':'https://www.opc.org/lc.html',
 **{n+'.zip':'https://codeload.github.com/'+repo+'/zip/refs/heads/master' for n,repo in {'morphhb':'openscriptures/morphhb','strongs':'openscriptures/strongs','strongs-greek':'morphgnt/strongs-dictionary-xml','tischendorf':'morphgnt/tischendorf'}.items()},
 'openbible-places.tsv':'https://a.openbible.info/geo/data/merged.txt',
 'natural-earth.geojson':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson',
 'three.min.js':'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
 'GLTFLoader.js':'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
 'OrbitControls.js':'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
 'THREE-LICENSE':'https://raw.githubusercontent.com/mrdoob/three.js/r128/LICENSE',
 'EBGaramond.ttf':'https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf',
 'GARAMOND-OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/OFL.txt'}
manifest=ROOT/'scripts/source-pins.json';pins=json.loads(manifest.read_text()) if manifest.exists() else {}
def fetch(item):
 name,url=item;p=DEST/name;p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists() and name in pins and hashlib.sha256(p.read_bytes()).hexdigest()==pins[name]['sha256']:return
 for retry in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BibleContentBuilder/1.0'}),timeout=55) as r:b=r.read()
   sha=hashlib.sha256(b).hexdigest()
   if name in pins and pins[name]['sha256']!=sha:raise ValueError('Upstream bytes changed')
   p.write_bytes(b);pins[name]={'url':url,'sha256':sha,'bytes':len(b)};print(name,len(b),flush=True);return
  except Exception as e:
   if retry==2:print('FAILED',name,str(e),flush=True);return
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(fetch,sources.items()))
manifest.write_text(json.dumps(pins,indent=2,ensure_ascii=False)+'\n')
