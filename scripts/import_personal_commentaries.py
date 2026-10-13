"""Convert user-supplied theWord commentary modules into private offline packages.

Read original UTF-16 text caches and explicit verse intervals. No text is
invented, translated, or attributed from design mockups. Originals remain in a
separate personal backup; they never enter the public source archive.
"""
import argparse, hashlib, json, re, sqlite3, zipfile
from pathlib import Path
parser=argparse.ArgumentParser(description='Importa comentarios autorizados de qualquer autor sem atribuir texto indevidamente.')
parser.add_argument('source', help='Banco SQLite theWord de origem')
parser.add_argument('--id',required=True,help='Identificador do modulo, ex.: HDL-JOAO ou JOSEMAR-SERMOES')
parser.add_argument('--title',required=True,help='Titulo real da obra')
parser.add_argument('--author',required=True,help='Autor real, ex.: Hernandes Dias Lopes ou Josemar Bessa')
parser.add_argument('--publisher',default='Editora nao informada')
parser.add_argument('--source-url',required=True)
args=parser.parse_args()
R=Path(__file__).resolve().parents[1];P=Path(args.source);OUT=R/'assets/private';OUT.mkdir(exist_ok=True)
c=sqlite3.connect('file:'+str(P)+'?mode=ro',uri=True);c.text_factory=bytes
assert c.execute('PRAGMA integrity_check').fetchone()[0]==b'ok','Source database must be intact'
config={n.decode():v.decode('utf-8','replace') if isinstance(v,bytes) else v for n,v in c.execute('SELECT name,value FROM config')}
counts={}
canon=sqlite3.connect(R/'assets/content/catalogue.sqlite')
for b,ch,n in canon.execute("SELECT book,chapter,max(verse) FROM verses WHERE translation='BLN4' GROUP BY book,chapter"):counts[b,ch]=n
canon.close();records=[];introductions=[];covered=set();used=set();skipped=[]
for topic,b,ch,start,end in c.execute('SELECT topic_id,bi,ci,fvi,tvi FROM bible_refs ORDER BY bi,ci,fvi,topic_id'):
 cached=c.execute('SELECT CAST(data AS BLOB) FROM content_search WHERE topic_id=?',(topic,)).fetchone()
 if not cached or not cached[0]:
  skipped.append(dict(topic=topic,reason='Empty source entry; no original text'));continue
 body=cached[0].decode('utf-16-le').replace('\ufeff','').replace('\u00ad','').replace('\r\n','\n').replace('\r','\n')
 body=re.sub(r'\n{3,}','\n\n',body).strip()
 assert '\ufffd' not in body and len(body)>30,(topic,'Invalid text')
 title=next((line.strip() for line in body.splitlines() if line.strip() and 'Emanuence' not in line),args.title)[:180]
 bibliographic=f'{args.author}; {args.title}; {args.publisher}; entrada do módulo original {topic}. Página impressa não informada pelo arquivo.'
 if ch==0 or start==0:
  introductions.append(dict(id=str(topic),kind='book_introduction',title=title,body=body,reference=f'{b}:{max(ch,1)}:1',metadata=dict(book=b,scope='book' if ch==0 else 'chapter',source_topic=topic,bibliography=bibliographic,references=[f'{b}:{max(ch,1)}:1'])))
  continue
 if (b,ch) not in counts or start>counts[b,ch]:skipped.append(dict(topic=topic,reason='Reference outside canonical address set'));continue
 # Invalid tails are preserved as metadata instead of silently claiming exact mapping.
 if end>counts[b,ch]:skipped.append(dict(topic=topic,reason='Range end not mapped',end=end));continue
 reference=f'{b}:{ch}:{start}';tail=f'{b}:{ch}:{max(start,end)}'
 records.append(dict(id=str(topic),reference=reference,end_reference=tail,title=title,body=body,commentary_kind='exegético e pastoral',bibliography=bibliographic))
 covered.add(b)
 for v in range(start,max(start,end)+1):used.add(f'{b}:{ch}:{v}')
c.close()
rights=f'© {args.author} e respectivos titulares/editoras. Arquivo fornecido pelo usuário para estudo pessoal. A inclusão local não concede autorização de distribuição pública. Preservar autoria, obra e localização. Não incluir estes conteúdos em repositório, ZIP público ou distribuição a terceiros.'
def save(id,title,kind,rows,metadata):
 name='data.json';data=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()
 manifest=dict(format_version=1,id=id,title=title,kind=kind,language='pt-BR',version='personal.1',author=args.author,license='Direitos reservados — uso pessoal',license_text=rights,source=args.source_url,dependencies=[],min_app_version='0.4.0',metadata=metadata,files={name:hashlib.sha256(data).hexdigest()})
 path=OUT/(id.lower()+'.biblepkg')
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False));z.writestr(name,data)
 with zipfile.ZipFile(path) as z:assert z.testzip() is None
 return dict(id=id,file=path.name)
meta=dict(entries=len(records),books=sorted(covered),covered_verse_addresses=len(used),coverage='Comentários por intervalos do arquivo de origem, não uma entrada individual para cada versículo.',source_sha256=hashlib.sha256(P.read_bytes()).hexdigest(),source_title=config.get('title'),source_version=config.get('version.date'),extraction='Texto UTF-16 do índice de conteúdo original. Formatação RVF convertida em texto com parágrafos; referências tornam-se links na interface.',skipped_unmapped=skipped)
catalog = OUT / 'modules.json'
modules = json.loads(catalog.read_text()) if catalog.is_file() else []
new=[save(args.id,args.title,'commentary',records,meta)]
if introductions:new.append(save(args.id+'-INTRO',args.title+' — introduções','dictionary',introductions,dict(scope='book/chapter',entries=len(introductions),source_sha256=meta['source_sha256'])))
ids={x['id'] for x in new};modules=[x for x in modules if not(isinstance(x,dict) and x.get('id') in ids)];modules.extend(new)
(OUT/'modules.json').write_text(json.dumps(modules,ensure_ascii=False,indent=2))
(OUT/(args.id.lower()+'-verification.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps(meta,ensure_ascii=False),flush=True)
