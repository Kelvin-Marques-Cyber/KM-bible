"""Fetch locally bundled OFL typefaces and CC0 photographic PBR materials."""
import concurrent.futures, hashlib, json, urllib.request
from pathlib import Path
from urllib.parse import quote
R=Path(__file__).resolve().parents[1]
fonts={
 'Lora':('lora','Lora[wght].ttf'), 'SourceSerif4':('sourceserif4','SourceSerif4[opsz,wght].ttf'),
 'NotoSerif':('notoserif','NotoSerif[wdth,wght].ttf'), 'LibreBaskerville':('librebaskerville','LibreBaskerville[wght].ttf'),
 'CrimsonPro':('crimsonpro','CrimsonPro[wght].ttf'), 'Merriweather':('merriweather','Merriweather[opsz,wdth,wght].ttf'),
 'CormorantGaramond':('cormorantgaramond','CormorantGaramond[wght].ttf'), 'Spectral':('spectral','Spectral-Regular.ttf'),
 'Bitter':('bitter','Bitter[wght].ttf'), 'AtkinsonHyperlegible':('atkinsonhyperlegible','AtkinsonHyperlegible-Regular.ttf'),
 'Lexend':('lexend','Lexend[wght].ttf'), 'NotoSans':('notosans','NotoSans[wdth,wght].ttf')}
def get(url):
 for attempt in range(3):
  try:return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'OfflineStudyAssetBuilder/1.0'}),timeout=35).read()
  except Exception:
   if attempt==2:raise
def font(item):
 family,(directory,name)=item;base='https://raw.githubusercontent.com/google/fonts/main/ofl/'+directory+'/'
 folder=R/'assets/fonts';folder.mkdir(exist_ok=True)
 p=folder/(family+'.ttf')
 if not p.exists():p.write_bytes(get(base+quote(name)))
 license=R/'assets/licenses'/('FONT-'+directory+'-OFL.txt')
 if not license.exists():license.write_bytes(get(base+'OFL.txt'))
 print('font',family,p.stat().st_size,flush=True)
 return dict(family=family,file='assets/fonts/'+p.name,source=base+quote(name),license='SIL OFL 1.1',license_file='assets/licenses/'+license.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
def material(id):
 folder=R/'content_sources/polyhaven';folder.mkdir(parents=True,exist_ok=True)
 meta=folder/(id+'.json')
 if not meta.exists():meta.write_bytes(get('https://api.polyhaven.com/files/'+id))
 info=json.loads(meta.read_bytes());result=dict(id=id,source='https://polyhaven.com/a/'+id,license='CC0',maps={})
 for key in ['Diffuse','Rough','nor_gl']:
  url=info[key]['1k']['jpg']['url'];p=folder/(id+'-'+key+'.jpg')
  if not p.exists():p.write_bytes(get(url))
  result['maps'][key]={'path':str(p),'source':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 print('texture',id,flush=True);return result
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
  result=list(ex.map(font,fonts.items()))
 (R/'assets/content/font-sources.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  result=list(ex.map(material,['wood_planks','old_sandstone_02','rough_linen','brown_leather']))
 (R/'assets/content/material-sources.json').write_text(json.dumps([{**r,'maps':{k:{x:v for x,v in m.items() if x!='path'} for k,m in r['maps'].items()}} for r in result],indent=2))
 p=R/'pubspec.yaml';text=p.read_text()
 for f in fonts:
  if '\n    - family: '+f+'\n' not in text:text+='    - family: '+f+'\n      fonts:\n        - asset: assets/fonts/'+f+'.ttf\n'
 p.write_text(text)
 (R/'assets/licenses/PBR-MATERIALS.md').write_text('# Materiais fotográficos\n\nTexturas wood_planks, old_sandstone_02, rough_linen e brown_leather, obtidas da API pública da Poly Haven. CC0: https://polyhaven.com/license e https://creativecommons.org/publicdomain/zero/1.0/\n\nImagens reduzidas a 1K e incorporadas nos modelos GLB; os materiais ilustram técnicas e superfícies, não comprovam a aparência de um artefato bíblico específico. Fontes e hashes em material-sources.json.\n')
