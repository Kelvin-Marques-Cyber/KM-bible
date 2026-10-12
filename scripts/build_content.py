"""Build local SQLite resources from their licensed primary source files."""
import copy,hashlib,html,json,re,shutil,sqlite3,struct,zipfile,zlib
from pathlib import Path
from lxml import etree
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'content_sources';OUT=ROOT/'assets/content';OUT.mkdir(parents=True,exist_ok=True)
LIC=ROOT/'assets/licenses';LIC.mkdir(exist_ok=True)
USFM='GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
OSIS='Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split()
def ref(s):
 a=s.split('.');return f'{OSIS.index(a[0])+1}:{int(a[1])}:{int(a[2])}'
def key(s):
 a=list(map(int,s.split(':')));return a[0]*1000000+a[1]*1000+a[2]
def connect(name,schema):
 p=OUT/(name+'.sqlite')
 if p.exists():p.unlink()
 d=sqlite3.connect(p);d.executescript(schema);return d
cat=connect('catalogue','''
CREATE TABLE content_modules(id TEXT PRIMARY KEY,title TEXT,kind TEXT,language TEXT,version TEXT,author TEXT,license TEXT,license_text TEXT,source TEXT,installed INTEGER,builtin INTEGER,metadata TEXT);
CREATE TABLE verses(translation TEXT,reference TEXT,book INTEGER,chapter INTEGER,verse INTEGER,text TEXT,metadata TEXT,PRIMARY KEY(translation,reference));
CREATE INDEX verses_ref ON verses(reference,translation);
CREATE VIRTUAL TABLE verse_search USING fts5(translation UNINDEXED,reference UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE verse_vocab USING fts5vocab(verse_search,'row');
CREATE TABLE verse_mappings(source_translation TEXT,source_reference TEXT,target_translation TEXT,target_reference TEXT,kind TEXT,source TEXT,PRIMARY KEY(source_translation,source_reference,target_translation));
CREATE TABLE documents(id TEXT PRIMARY KEY,module_id TEXT,kind TEXT,title TEXT,body TEXT,reference TEXT,metadata TEXT);
CREATE VIRTUAL TABLE document_search USING fts5(id UNINDEXED,title,body,tokenize='unicode61 remove_diacritics 2');
CREATE TABLE studies(id TEXT PRIMARY KEY,level INTEGER,topic TEXT,target TEXT,title TEXT,exposition TEXT,response TEXT,strongest TEXT,rejoinder TEXT,refs TEXT,sources TEXT);
CREATE VIRTUAL TABLE study_search USING fts5(id UNINDEXED,title,exposition,response,tokenize='unicode61 remove_diacritics 2');
CREATE TABLE lexicon_ownership(module_id TEXT,lexeme_id TEXT);
''')
lib=connect('library','''
CREATE TABLE commentary_entries(id TEXT PRIMARY KEY,module_id TEXT,reference TEXT,end_reference TEXT,start_key INTEGER,end_key INTEGER,title TEXT,body TEXT,kind TEXT,bibliography TEXT);
CREATE INDEX commentary_refs ON commentary_entries(start_key,end_key,module_id);
CREATE VIRTUAL TABLE commentary_search USING fts5(id UNINDEXED,module_id UNINDEXED,title,body,tokenize='unicode61 remove_diacritics 2');
''')
lex=connect('lexicon','''
CREATE TABLE lexemes(id TEXT PRIMARY KEY,lemma TEXT,transliteration TEXT,gloss TEXT,definition TEXT,language TEXT,source TEXT);
CREATE TABLE words(id TEXT PRIMARY KEY,edition TEXT,reference TEXT,position INTEGER,surface TEXT,lexeme TEXT,morphology TEXT,module_id TEXT);
CREATE INDEX words_ref ON words(reference,position);CREATE INDEX words_lexeme ON words(lexeme,reference);
CREATE VIRTUAL TABLE lexical_search USING fts5(id UNINDEXED,lemma,transliteration,gloss,definition,tokenize='unicode61 remove_diacritics 2');
''')
modules=[]
def module(id,title,kind,language,author,license,source,version='1.0',installed=1,license_text='',metadata=None):
 m={'id':id,'title':title,'kind':kind,'language':language,'version':version,'author':author,'license':license,'license_text':license_text or license,'source':source,'installed':installed,'builtin':1,'metadata':metadata or {}}
 modules.append(m);cat.execute('INSERT INTO content_modules VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[m[k] if k!='metadata' else json.dumps(m[k],ensure_ascii=False) for k in ['id','title','kind','language','version','author','license','license_text','source','installed','builtin','metadata']]);return m
def verse(edition,r,text,meta=None):
 b,c,v=map(int,r.split(':'));cat.execute('INSERT INTO verses VALUES(?,?,?,?,?,?,?)',(edition,r,b,c,v,text,json.dumps(meta or {},ensure_ascii=False)));cat.execute('INSERT INTO verse_search VALUES(?,?,?)',(edition,r,text))
counts={};allrefs=[]
bl_license=(SRC/'blivre-license.md').read_text(encoding='utf-8-sig');credits=(SRC/'blivre-credits.md').read_text(encoding='utf-8-sig')
(LIC/'BIBLIA-LIVRE.md').write_text(bl_license+'\n'+credits)
for edition,file in [('BLN4','bln4'),('BLTR','bltr')]:
 z=zipfile.ZipFile(SRC/(file+'.zip'));lines=z.read(z.namelist()[0]).decode('utf-8-sig').splitlines()
 module(edition,'Bíblia Livre — '+('Texto crítico' if edition=='BLN4' else 'Textus Receptus'),'bible','pt','Diego Renato dos Santos; Mario Sérgio de Souza Figueira; Marco Antonio Teles da Costa','CC BY 3.0 BR','https://github.com/blivre/BibliaLivre/releases/tag/2018.2.0','2018.2.0',license_text=bl_license,metadata={'versification':'KJV','coverage':'66 livros; texto integral'})
 for line in lines:
  m=re.match(r'([A-Z0-9]+) (\d+):(\d+) (.*)',line);assert m,line
  b=USFM.index({'SOL':'SNG','EZE':'EZK','JOE':'JOL','NAH':'NAM','MAR':'MRK','JOH':'JHN','PHI':'PHP','JAM':'JAS','1JO':'1JN','2JO':'2JN','3JO':'3JN'}.get(m[1],m[1]))+1;c=int(m[2]);v=int(m[3]);r=f'{b}:{c}:{v}';verse(edition,r,m[4])
  if edition=='BLN4':counts[b,c]=max(counts.get((b,c),0),v);allrefs.append(r)
 assert len(lines)==31102
def sword(name,testament):
 z=zipfile.ZipFile(SRC/(name+'.zip'));conf=z.read(next(n for n in z.namelist() if n.endswith('.conf'))).decode('utf-8-sig')
 base=re.search(r'^DataPath=(.*)$',conf,re.M)[1].strip().removeprefix('./').rstrip('/')+'/'
 code='c' if 'BlockType=CHAPTER' in conf else 'b'
 try:bs=z.read(base+testament+'.'+code+'zs');vs=z.read(base+testament+'.'+code+'zv');zz=z.read(base+testament+'.'+code+'zz')
 except KeyError:return [],conf
 blocks={}
 def entry(index):
  if index*10+10>len(vs):return ''
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
   for v in range(1,counts[b,c]+1):result.append((f'{b}:{c}:{v}',entry(index)));index+=1
 assert index==len(vs)//10,(name,testament,index,len(vs)//10)
 return result,conf
def plain(markup):
 s=re.sub(r'<note\b.*?</note>|<title\b.*?</title>','',markup,flags=re.S|re.I)
 s=re.sub(r'</p>|</div>|<br\s*/?>','\n\n',s,flags=re.I)
 return re.sub(r'[ \t]+',' ',html.unescape(re.sub(r'<[^>]*>','',s))).strip()
for name,title,language,license in [('ASV','American Standard Version (1901)','en','Public Domain'),('SpaRV','Reina-Valera (1909)','es','Public Domain'),('TR','Textus Receptus (1550/1894)','grc','CC BY-NC-SA 4.0')]:
 saved=0;conf=''
 for testament in ['ot','nt']:
  rows,conf=sword(name,testament)
  for r,raw in rows:
   t=plain(raw)
   if t:verse(name,r,t);saved+=1
 metadata={'versification':'KJV','nonempty_verses':saved,'coverage':'NT' if name=='TR' else '66 livros'}
 module(name,title,'bible',language,'CrossWire Bible Society / editores históricos',license,f'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName={name}',license_text=conf,metadata=metadata)
 (LIC/(name+'.txt')).write_text(conf)
for name,title,author in [('MHCC','Matthew Henry — Concise Commentary','Matthew Henry'),('Barnes','Barnes — New Testament Notes','Albert Barnes')]:
 total=0;conf=''
 for testament in ['ot','nt']:
  rows,conf=sword(name,testament);groups=[]
  for r,raw in rows:
   body=plain(raw)
   if not body:continue
   if groups and groups[-1][2]==body and groups[-1][1].split(':')[:2]==r.split(':')[:2]:groups[-1][1]=r
   else:groups.append([r,r,body])
  for start,end,body in groups:
   id=f'{name}:{start}';lib.execute('INSERT INTO commentary_entries VALUES(?,?,?,?,?,?,?,?,?,?)',(id,name,start,end,key(start),key(end),start+' — '+end,body,'exegesis',title));lib.execute('INSERT INTO commentary_search VALUES(?,?,?,?)',(id,name,start+' — '+end,body));total+=1
 module(name,title,'commentary','en',author,'Public Domain',f'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName={name}',license_text=conf,metadata={'entries':total,'coverage':'NT' if name=='Barnes' else '66 livros'})
 (LIC/(name+'.txt')).write_text(conf)
def document(id,module_id,kind,title,body,reference='',metadata=None):
 cat.execute('INSERT INTO documents VALUES(?,?,?,?,?,?,?)',(id,module_id,kind,title,body,reference,json.dumps(metadata or {},ensure_ascii=False)));cat.execute('INSERT INTO document_search VALUES(?,?,?)',(id,title,body))
parser=etree.XMLParser(huge_tree=True,resolve_entities=False,no_network=True)
p=etree.parse(str(SRC/'creeds.xml'),parser);d=p.xpath('//*[@id="iv.xvii.ii"]')[0];parts=[];current=[];titles=[]
for row in d.xpath('.//tr'):
 cells=[v for v in row if v.tag in ['td','th']]
 if not cells:continue
 cell=copy.deepcopy(cells[0]);etree.strip_elements(cell,'note','pb',with_tail=False)
 text=re.sub(r'\s+',' ',' '.join(cell.itertext())).strip()
 if re.match(r'^Chapter [IVXLC]+\.',text,re.I):
  if current:parts.append('\n\n'.join(current))
  current=[];titles.append(text)
 elif titles and text:current.append(text)
if current:parts.append('\n\n'.join(current))
assert len(parts)==33,len(parts)
guides=json.loads((OUT/'confessional-guides.json').read_text()) if (OUT/'confessional-guides.json').exists() else {}
for i,body in enumerate(parts,1):
 guide=guides.get('WCF',{}).get(str(i),{})
 prefix=(guide.get('body','')+'\n\n---\n\n' if guide else '')
 document(f'WCF.{i}','WCF','confession',f'{i:02d} · '+guide.get('title',titles[i-1]),prefix+'Original histórico em inglês (1647)\n\n'+body,metadata={'number':i,'references':guide.get('refs',[]),'original_language':'en','guide_language':'pt','edition':'1647 original; notas e texto latino excluídos'})
module('WCF','Confissão de Fé de Westminster — 33 capítulos','confession','en+pt','Assembleia de Westminster','Public Domain (original 1647); guias próprios','https://www.ccel.org/ccel/schaff/creeds3.html',metadata={'entries':33,'edition':'Histórica 1647. As revisões americanas e da magistratura civil não são apresentadas como edição oficial da IPB.'})
for id,file,count,title in [('WSC','wsc.html',107,'Breve Catecismo de Westminster'),('WLC','wlc.html',196,'Catecismo Maior de Westminster')]:
 page=etree.HTML((SRC/file).read_bytes());questions=page.xpath('//div[@class="mainBlock"]//p');seen=0
 for node in questions:
  text=re.sub(r'\s+',' ',' '.join(node.itertext())).strip();m=re.match(r'Q\. (\d+)\. (.+)',text)
  if not m:continue
  n=int(m[1]);seen+=1;guide=guides.get(id,{}).get(str(n),{});question=m[2].split(' A. ')[0]
  body=(guide.get('body','')+'\n\n---\n\n' if guide else '')+'Original histórico em inglês (1647)\n\n'+text
  document(f'{id}.{n}',id,'confession',f'{n:03d} · '+guide.get('title',question),body,metadata={'number':n,'references':guide.get('refs',[]),'original_language':'en','guide_language':'pt'})
 assert seen==count,(id,seen)
 module(id,title+f' — {count} perguntas','confession','en+pt','Assembleia de Westminster','Public Domain (original 1647); guias próprios','https://www.opc.org/'+('sc.html' if id=='WSC' else 'lc.html'),metadata={'entries':count,'edition':'Texto clássico de 1647; guias em português próprios, não são tradução oficial da IPB.'})
for id,title in [('ARA','Almeida Revista e Atualizada — RA'),('NAA','Nova Almeida Atualizada'),('ARC','Almeida Revista e Corrigida'),('NTLH','Nova Tradução na Linguagem de Hoje')]:
 module(id,title,'bible','pt','Sociedade Bíblica do Brasil','Direitos reservados — licença pessoal fornecida pelo usuário','https://www.sbb.org.br/',installed=0,metadata={'priority':0 if id=='ARA' else 1,'availability':'Importar o arquivo autorizado para uso pessoal. O texto protegido fica separado do repositório.'})
for id,title,author in [('HDL','Comentários de Hernandes Dias Lopes','Hernandes Dias Lopes'),('JBB','Comentários de Josemar Bessa','Josemar Bessa')]:
 module(id,title,'commentary','pt',author,'Direitos reservados — requer autorização','',installed=0,metadata={'availability':'Importar pacote autorizado'})
(LIC/'WESTMINSTER.md').write_text('Confissão de Fé (33 capítulos), Breve Catecismo (107) e Catecismo Maior (196): documentos originais da Assembleia de Westminster, 1647, em domínio público. Transcrições: CCEL / Philip Schaff e OPC (texto clássico). Os guias e sínteses em português são material próprio, não traduções oficiais da IPB. A Confissão histórica distingue-se das revisões posteriores, especialmente capítulos 23 e 31. A origem e o idioma aparecem em cada módulo.\n')
# Lexemes: original Strong dictionary only; modern TWOT indices are excluded.
z=zipfile.ZipFile(SRC/'strongs-greek.zip');root=etree.fromstring(z.read(next(n for n in z.namelist() if n.endswith('strongsgreek.xml'))),parser)
for e in root.xpath('//entry'):
 number=e.get('strongs') or e.get('n');g=e.find('greek')
 if not number or g is None:continue
 id='G'+str(int(number));lemma=g.get('unicode','');trans=g.get('translit','');desc=' '.join(e.itertext()).strip();gloss=' '.join(e.find('strongs_def').itertext()) if e.find('strongs_def') is not None else desc
 lex.execute('INSERT OR REPLACE INTO lexemes VALUES(?,?,?,?,?,?,?)',(id,lemma,trans,gloss,desc,'grc','Strong, edição histórica em domínio público'))
z=zipfile.ZipFile(SRC/'strongs.zip');root=etree.fromstring(z.read('strongs-master/hebrew/StrongHebrewG.xml'),parser)
for e in root.xpath('//*[local-name()="div" and @type="entry"]'):
 word=next(iter(e.xpath('./*[local-name()="w"]')),None)
 if word is None:continue
 id=word.get('ID');lemma=word.get('lemma','');trans=word.get('xlit','');gloss=' '.join(e.xpath('./*[local-name()="list"]//text()'));defs=' '.join(e.xpath('./*[local-name()="note"]//text()'))
 if id:lex.execute('INSERT OR REPLACE INTO lexemes VALUES(?,?,?,?,?,?,?)',(id,lemma,trans,gloss,defs,'he','Strong, edição histórica em domínio público'))
# Original Hebrew/Aramaic corpus; no assumed alignment with Portuguese words.
z=zipfile.ZipFile(SRC/'morphhb.zip');license=z.read('morphhb-master/LICENSE.md').decode();(LIC/'OSHB.md').write_text(license+'\nOriginal work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb\n')
hebrew_verses=0
for name in z.namelist():
 if '/wlc/' not in name or not name.endswith('.xml'):continue
 root=etree.fromstring(z.read(name),parser)
 for v in root.xpath('//*[local-name()="verse" and @osisID]'):
  r=ref(v.get('osisID'));tokens=v.xpath('.//*[local-name()="w"]');surfaces=[]
  for position,w in enumerate(tokens):
   surface=''.join(w.itertext());surfaces.append(surface);strong=re.search(r'\d+',w.get('lemma',''));lid='H'+str(int(strong[0])) if strong else ''
   lex.execute('INSERT INTO words VALUES(?,?,?,?,?,?,?,?)',(f'OSHB:{r}:{position}','OSHB',r,position,surface,lid,w.get('morph',''),'OSHB'))
  if surfaces:verse('OSHB',r,' '.join(surfaces));hebrew_verses+=1
module('OSHB','Westminster Leningrad Codex / OSHB','bible','he','Open Scriptures Hebrew Bible; Whitaker e Parunak','WLC: Public Domain; morfologia OSHB: CC BY 4.0','https://github.com/openscriptures/morphhb',license_text=license,metadata={'versification':'Leningrad','coverage':'Antigo Testamento hebraico/aramaico','nonempty_verses':hebrew_verses,'credit':'Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb'})
z=zipfile.ZipFile(SRC/'tischendorf.zip');root=etree.fromstring(z.read('tischendorf-master/text/osisxml/tischendorfmorph.OSIS.xml'),parser);active=None;position=0;positions={}
for node in root.iter():
 if etree.QName(node).localname=='verse':
  if node.get('sID'):active=ref(node.get('sID'));position=positions.get(active,0)
  elif node.get('eID'):active=None
 elif etree.QName(node).localname=='w' and active:
  surface=''.join(node.itertext());m=re.search(r'strong:G(\d+)',node.get('lemma',''));lid='G'+str(int(m[1])) if m else ''
  lex.execute('INSERT INTO words VALUES(?,?,?,?,?,?,?,?)',(f'TIS:{active}:{position}','TIS',active,position,surface,lid,node.get('morph','').removeprefix('robinson:'),'TIS'));position+=1;positions[active]=position
lex.execute('INSERT INTO lexical_search SELECT id,lemma,transliteration,gloss,definition FROM lexemes')
(LIC/'STRONG-TIS.md').write_text('Strong histórico e Tischendorf 8 (1868) com marcação de MorphGNT: domínio público declarado pelos projetos. Índices TWOT não distribuídos. Fontes: https://github.com/openscriptures/strongs , https://github.com/morphgnt/strongs-dictionary-xml e https://github.com/morphgnt/tischendorf . Glosas históricas em inglês; não equivalem automaticamente ao sentido de uma palavra em todo contexto.\n')
# Seed original theological studies from reviewed, sourced data.
if (OUT/'studies.json').exists():
 for s in json.loads((OUT/'studies.json').read_text()):
  cat.execute('INSERT INTO studies VALUES(?,?,?,?,?,?,?,?,?,?,?)',(s['id'],s['level'],s['topic'],s['target'],s['title'],s['exposition'],s['response'],s['strongest'],s['rejoinder'],json.dumps(s['refs']),json.dumps(s['sources'])))
  cat.execute('INSERT INTO study_search VALUES(?,?,?,?)',(s['id'],s['title'],s['exposition'],s['response']))
for db in [cat,lib,lex]:db.commit();db.execute('VACUUM');db.close()
for name in ['catalogue','library','lexicon']:
 p=OUT/(name+'.sqlite');(OUT/(name+'.sha256')).write_text(hashlib.sha256(p.read_bytes()).hexdigest()+'\n');print(name,p.stat().st_size,flush=True)
(OUT/'modules.json').write_text(json.dumps(modules,ensure_ascii=False,indent=2)+'\n')
for n in ['three.min.js','GLTFLoader.js','OrbitControls.js']:shutil.copy2(SRC/n,ROOT/'assets/3d'/n)
for n in ['THREE-LICENSE','GARAMOND-OFL.txt']:shutil.copy2(SRC/n,LIC/n)
shutil.copy2(SRC/'EBGaramond.ttf',ROOT/'assets/content/EBGaramond.ttf')
