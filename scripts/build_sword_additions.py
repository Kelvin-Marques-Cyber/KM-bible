"""Convert separately licensed public-domain modules, without rebuilding core DBs."""
import hashlib,html,json,re,sqlite3,struct,zipfile,zlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];SRC=R/'content_sources/sword';OUT=R/'assets/bundled';OUT.mkdir(exist_ok=True)
db=sqlite3.connect(R/'assets/content/catalogue.sqlite');counts={(b,c):n for b,c,n in db.execute("SELECT book,chapter,max(verse) FROM verses WHERE translation='BLN4' GROUP BY book,chapter")};db.close()
def sword(name,testament):
 z=zipfile.ZipFile(SRC/(name+'.zip'));assert z.testzip() is None
 conf=z.read(next(n for n in z.namelist() if n.endswith('.conf'))).decode('utf-8-sig')
 assert re.search(r'^DistributionLicense=Public Domain\s*$',conf,re.M) or (name=='porblt2022eb' and 'DistributionLicense=Creative Commons: by-sa' in conf and 'license 4.0' in conf),name+' must have a compatible grant'
 scheme=re.search(r'^Versification=(\S+)',conf,re.M)
 scheme_name=scheme[1] if scheme else 'KJV'
 local_counts=counts
 if scheme_name in ['Calvin','NRSV']:
  code=scheme_name.lower();header=(SRC/('canon_'+code+'.h')).read_text();part=re.search(r'int vm_'+code+r'\[\]\s*=\s*\{(.*?)\};',header,re.S)[1]
  values=[int(v) for v in re.findall(r'\d+',re.sub(r'//[^\n]*|/\*.*?\*/','',part,flags=re.S))]
  keys=sorted(counts);assert len(values)==len(keys)+1 or len(values)==len(keys),(len(values),len(keys))
  local_counts=dict(zip(keys,values))
 elif scheme_name!='KJV':raise ValueError(name+' needs its own versification parser')
 base=re.search(r'^DataPath=(.*)$',conf,re.M)[1].strip().removeprefix('./').rstrip('/')+'/'
 code='c' if 'BlockType=CHAPTER' in conf else 'b'
 try:bs=z.read(base+testament+'.'+code+'zs');vs=z.read(base+testament+'.'+code+'zv');zz=z.read(base+testament+'.'+code+'zz')
 except KeyError:return [],conf
 blocks={}
 def entry(index):
  bid,off,n=struct.unpack_from('<IIH',vs,index*10)
  if not n:return ''
  if bid not in blocks:
   start,length,_=struct.unpack_from('<III',bs,bid*12);blocks[bid]=zlib.decompress(zz[start:start+length])
  return blocks[bid][off:off+n].decode('utf-8','replace')
 index=2;result=[]
 for b in range(1,40) if testament=='ot' else range(40,67):
  index+=1
  for c in range(1,max(ch for bk,ch in counts if bk==b)+1):
   index+=1
   for v in range(1,local_counts[b,c]+1):result.append((f'{b}:{c}:{v}',entry(index)));index+=1
 assert index==len(vs)//10,(name,testament,index,len(vs)//10)
 return result,conf
def plain(text):
 text=re.sub(r'<note\b.*?</note>|<title\b.*?</title>|<RF>.*?<Rf>|<TS>.*?<Ts>','',text,flags=re.S|re.I)
 text=re.sub(r'</p>|</div>|<br\s*/?>','\n\n',text,flags=re.I)
 return re.sub(r'[ \t]+',' ',html.unescape(re.sub('<[^>]*>','',text))).strip()
def package(id,title,kind,language,author,rows,conf,metadata):
 name='verses.json' if kind=='bible' else 'data.json';payload=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode();source='https://www.crosswire.org/sword/modules/ModInfo.jsp?modName='+id
 if id=='porblt2022eb':source='https://ebible.org/Scriptures/details.php?id=porblt'
 m=dict(format_version=1,id=id,title=title,kind=kind,language=language,version='public.1',author=author,license='CC BY-SA 4.0' if id=='porblt2022eb' else 'Domínio público',license_text=conf,source=source,dependencies=[],min_app_version='0.4.0',metadata=metadata,files={name:hashlib.sha256(payload).hexdigest()})
 f=OUT/(id+'.biblepkg')
 with zipfile.ZipFile(f,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:z.writestr('manifest.json',json.dumps(m,ensure_ascii=False));z.writestr(name,payload)
 (R/'assets/licenses'/('SWORD-'+id+'.txt')).write_text(conf)
 print(id,'entries',len(rows),'text characters',sum(len(r.get('text',r.get('body',''))) for r in rows),'package bytes',f.stat().st_size,flush=True)
 return dict(id=id,file=f.name)
modules=[]
for id,title,language,author in [('Darby','Darby (1889)','en','John Nelson Darby'),('YLT','Young — Literal Translation (1898)','en','Robert Young'),('Webster','Webster (1833)','en','Noah Webster'),('FreBDM1744','David Martin (1744)','fr','David Martin'),('porblt2022eb','Bíblia Livre Para Todos — NT (2022)','pt','Free Bible Ministry, Inc. © 2022')]:
 rows=[]
 for testament in ['ot','nt']:
  raw,conf=sword(id,testament)
  for reference,text in raw:
   body=plain(text)
   if body:rows.append(dict(reference=reference,text=body))
 modules.append(package(id,title,'bible',language,author,rows,conf,dict(versification=('Calvin' if id=='FreBDM1744' else 'NRSV' if id=='porblt2022eb' else 'KJV'),nonempty_verses=len(rows),coverage='27 livros do Novo Testamento; numeração NRSV' if id=='porblt2022eb' else '66 livros; numeração e texto próprios da edição',modifications='Marcação OSIS/GBF convertida em texto; títulos e notas editoriais omitidos. Nenhuma alteração editorial do texto bíblico. Não se presume equivalência perfeita com a RA.')))
id='CalvinCommentaries';groups=[]
for testament in ['ot','nt']:
 raw,conf=sword(id,testament)
 for r,text in raw:
  body=plain(text)
  if not body:continue
  if groups and groups[-1][2]==body and groups[-1][1].split(':')[:2]==r.split(':')[:2]:groups[-1][1]=r
  else:groups.append([r,r,body])
rows=[dict(id=start,reference=start,end_reference=end,title='Comentário de João Calvino',body=body,commentary_kind='exegético reformado',bibliography='João Calvino; coleção CCEL, traduções históricas para inglês; entrada '+start+'–'+end+'; SWORD CalvinCommentaries 1.1 (2022).') for start,end,body in groups]
modules.append(package(id,'João Calvino — comentários reunidos','commentary','en','João Calvino; tradutores históricos da coleção CCEL',rows,conf,dict(coverage='Livros e passagens efetivamente presentes no módulo CCEL/CrossWire; não cobre toda a Bíblia.',entries=len(rows),books=sorted({int(r['reference'].split(':')[0]) for r in rows}))))
(OUT/'modules.json').write_text(json.dumps(modules,ensure_ascii=False,indent=2))
p=R/'pubspec.yaml';text=p.read_text()
if '    - assets/bundled/' not in text:text=text.replace('    - assets/private/','    - assets/private/\n    - assets/bundled/')
p.write_text(text)
