"""Convert Torrey's licensed historic topical index into Portuguese static data.
Biblical addresses are parsed and validated independently of text translation.
"""
import hashlib,html,json,re,sqlite3,struct,zipfile
from pathlib import Path
import ctranslate2,sentencepiece
R=Path(__file__).resolve().parents[1];M=R/'content_sources/translation-model'
books=['Gênesis','Êxodo','Levítico','Números','Deuteronômio','Josué','Juízes','Rute','1 Samuel','2 Samuel','1 Reis','2 Reis','1 Crônicas','2 Crônicas','Esdras','Neemias','Ester','Jó','Salmos','Provérbios','Eclesiastes','Cântico dos Cânticos','Isaías','Jeremias','Lamentações','Ezequiel','Daniel','Oseias','Joel','Amós','Obadias','Jonas','Miqueias','Naum','Habacuque','Sofonias','Ageu','Zacarias','Malaquias','Mateus','Marcos','Lucas','João','Atos','Romanos','1 Coríntios','2 Coríntios','Gálatas','Efésios','Filipenses','Colossenses','1 Tessalonicenses','2 Tessalonicenses','1 Timóteo','2 Timóteo','Tito','Filemom','Hebreus','Tiago','1 Pedro','2 Pedro','1 João','2 João','3 João','Judas','Apocalipse']
aliases=['Ge Gen Gn','Ex Exo','Le Lev Lv','Nu Num Nm','De Deu Dt','Jos Josh Js','Jud Jdg Jz','Ru Rut Rt','1Sa 1Sam','2Sa 2Sam','1Ki 1Kgs','2Ki 2Kgs','1Ch 1Chr','2Ch 2Chr','Ezr','Ne Neh','Es Est','Job','Ps Psa','Pr Pro Prov','Ec Ecc Eccl','So Son Song','Isa Is','Jer Jr','La Lam','Eze Ezk Ezek','Da Dan','Ho Hos','Joe Joel','Am Amo','Ob Oba Obad','Jon Jonah','Mic Mi','Na Nah','Hab','Zep Zeph','Hag','Zec Zech','Mal','Mt Mat Matt','Mr Mk Mark','Lu Lk Luke','Joh Jn John','Ac Act Acts','Ro Rom','1Co 1Cor','2Co 2Cor','Ga Gal','Eph','Php Phil','Col','1Th 1Thess','2Th 2Thess','1Ti 1Tim','2Ti 2Tim','Tit','Phm Phile Philem','Heb','Jas Ja James','1Pe 1Pet','2Pe 2Pet','1Jo 1Jn 1John','2Jo 2Jn 2John','3Jo 3Jn 3John','Jude','Re Rev']
lookup={a.lower():i+1 for i,names in enumerate(aliases) for a in names.split()}
core=sqlite3.connect(R/'assets/content/catalogue.sqlite');valid={r[0] for r in core.execute("SELECT reference FROM verses WHERE translation='BLN4'")};counts={(b,c):n for b,c,n in core.execute("SELECT book,chapter,max(verse) FROM verses WHERE translation='BLN4' GROUP BY book,chapter")};core.close()
skipped=[]
def refs(value):
 result=[];book=None;chapter=None
 for item in re.split('[;,]',value):
  item=item.strip().replace('–','-');match=re.match(r'([123]?\s*[A-Za-z]+)\.?\s+(.*)',item)
  if match:
   book=lookup.get(match[1].replace(' ','').lower());item=match[2]
  match=re.match(r'(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$',item)
  if not match or book is None:skipped.append(value);continue
  if match[1]:chapter=int(match[1])
  if chapter is None:skipped.append(value);continue
  start=int(match[2]);end_ch=int(match[3] or chapter);end=int(match[4] or start)
  if end_ch<chapter:skipped.append(value);continue
  for ch in range(chapter,end_ch+1):
   for verse in range(start if ch==chapter else 1,(end if ch==end_ch else counts.get((book,ch),0))+1):
    reference=f'{book}:{ch}:{verse}'
    if reference in valid:result.append(reference)
    else:skipped.append(reference)
 return list(dict.fromkeys(result))
def label(reference):
 b,c,v=map(int,reference.split(':'));return f'{books[b-1]} {c}:{v}'
def plain(text):return html.unescape(re.sub('<[^>]*>','',text)).strip(' \r\n-.')
with zipfile.ZipFile(R/'content_sources/sword/Torrey.zip') as z:
 idx=z.read('modules/lexdict/rawld/torrey/torrey.idx');data=z.read('modules/lexdict/rawld/torrey/torrey.dat');conf=z.read('mods.d/torrey.conf').decode()
 assert 'DistributionLicense=Public Domain' in conf
 rows=[]
 for i in range(len(idx)//6):
  offset,size=struct.unpack_from('<IH',idx,i*6);entry=data[offset:offset+size].decode('utf-8','strict');title,body=entry.split('\n',1)
  sections=[];last=0
  for m in re.finditer(r'<scripRef>(.*?)</scripRef>',body,re.S|re.I):
   sections.append(dict(text=plain(body[last:m.start()]),refs=refs(plain(m[1]))));last=m.end()
  tail=plain(body[last:])
  if tail:sections.append(dict(text=tail,refs=[]))
  rows.append(dict(id='torrey-'+hashlib.sha256(title.strip().encode()).hexdigest()[:16],title=title.strip(),sections=sections,original=entry))
source=sentencepiece.SentencePieceProcessor(model_file=str(M/'source.spm'));target=sentencepiece.SentencePieceProcessor(model_file=str(M/'target.spm'));tr=ctranslate2.Translator(str(M/'ct2'),device='cpu',compute_type='int8',inter_threads=3,intra_threads=2)
cache=sqlite3.connect('/tmp/torrey-pt-cache.sqlite');cache.execute('CREATE TABLE IF NOT EXISTS cache(original TEXT PRIMARY KEY,body TEXT)');translated=dict(cache.execute('SELECT * FROM cache'))
texts=list(dict.fromkeys([r['title'] for r in rows]+[s['text'] for r in rows for s in r['sections'] if s['text']]))
missing=[t for t in texts if t not in translated]
for start in range(0,len(missing),96):
 batch=missing[start:start+96];tokens=[['>>pob<<']+source.encode(t,out_type=str)+['</s>'] for t in batch];out=tr.translate_batch(tokens,beam_size=1,max_batch_size=384,batch_type='tokens',max_decoding_length=512)
 for original,result in zip(batch,out):
  body=target.decode([t for t in result.hypotheses[0] if t not in ['</s>','>>pob<<','>>por<<']]);translated[original]=body;cache.execute('INSERT OR REPLACE INTO cache VALUES(?,?)',(original,body))
 cache.commit()
 if start%480==0:print('TRANSLATED',min(start+96,len(missing)),'/',len(missing),flush=True)
overrides={'LOVE TO GOD':'Amor a Deus','LOVE OF GOD':'Amor de Deus','LOVE TO CHRIST':'Amor a Cristo','LOVE TO MAN':'Amor ao próximo','LOVE OF CHRIST':'Amor de Cristo','FAITH':'Fé','ADOPTION':'Adoção','JUSTIFICATION':'Justificação','SANCTIFICATION':'Santificação','PRAYER':'Oração','REPENTANCE':'Arrependimento','GRACE':'Graça','HOPE':'Esperança','HOLINESS':'Santidade','GOD':'Deus','JESUS CHRIST':'Jesus Cristo','CHARITY':'Amor e caridade','SALVATION':'Salvação','ACCESS TO GOD':'Acesso a Deus'}
destination=R/'assets/content/topics.sqlite';temporary=Path('/tmp/bible-topics-final.sqlite');temporary.unlink(missing_ok=True);db=sqlite3.connect(temporary)
db.executescript("CREATE TABLE topics(id TEXT PRIMARY KEY,title TEXT,body TEXT,source TEXT,original_title TEXT,original_body TEXT,review_status TEXT);CREATE TABLE topic_verses(topic_id TEXT,reference TEXT,kind TEXT,PRIMARY KEY(topic_id,reference));CREATE INDEX topic_verse_reference ON topic_verses(reference);CREATE VIRTUAL TABLE topic_search USING fts5(id UNINDEXED,title,body,tokenize='unicode61 remove_diacritics 2');CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);")
for row in rows:
 title=overrides.get(row['title'],translated[row['title']].capitalize());body=[];links=[]
 for section in row['sections']:
  if section['text']:body.append('### '+translated[section['text']])
  if section['refs']:
   body.append(' · '.join(f'[{label(ref)}](biblia:{ref})' for ref in section['refs']));links+=section['refs']
 text='\n\n'.join(body);status='Tradução de estudo em português; revisão especializada pendente. Índice histórico de R. A. Torrey, de tradição evangélica; associações editoriais na numeração KJV.'
 db.execute('INSERT INTO topics VALUES(?,?,?,?,?,?,?)',(row['id'],title,text,'R. A. Torrey — New Topical Textbook, domínio público; CrossWire, módulo 1.3.',row['title'],row['original'],status));db.execute('INSERT INTO topic_search VALUES(?,?,?)',(row['id'],title,text));db.executemany('INSERT OR IGNORE INTO topic_verses VALUES(?,?,?)',[(row['id'],ref,'editorial') for ref in links])
coverage=dict(topics=len(rows),links=db.execute('SELECT count(*) FROM topic_verses').fetchone()[0],verses=db.execute('SELECT count(DISTINCT reference) FROM topic_verses').fetchone()[0],source='https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Torrey',license='Domínio público; tradução de apoio CC BY 4.0',unresolved=sorted(set(skipped)))
db.executemany('INSERT INTO metadata VALUES(?,?)',[(k,json.dumps(v,ensure_ascii=False)) for k,v in coverage.items()]);db.commit();db.execute('VACUUM');assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';db.close()
staging=destination.with_suffix('.sqlite.tmp');staging.write_bytes(temporary.read_bytes());staging.replace(destination)
(R/'assets/content/topics.sha256').write_text(hashlib.sha256(destination.read_bytes()).hexdigest());(R/'assets/content/topics-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2));(R/'assets/licenses/TORREY-SOURCE.txt').write_text(conf+'\n\nTradução de estudo: OPUS-MT Helsinki-NLP eng–pob 2022, CC BY 4.0; revisão especializada pendente. Referências bíblicas preservadas e verificadas; comentários originais não representam automaticamente a tradição presbiteriana.\n')
print(json.dumps({k:v for k,v in coverage.items() if k!='unresolved'},ensure_ascii=False),flush=True)
