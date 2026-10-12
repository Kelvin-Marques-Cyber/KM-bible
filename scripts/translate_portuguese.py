"""Resumable build-time translation of public-domain editorial resources.

The distributed app retrieves these static records offline. Originals are kept
for verification. These are study translations pending specialist review, not
official confessional translations or new editions of the Bible.
"""
import hashlib,json,re,sqlite3,time
from pathlib import Path
import ctranslate2,sentencepiece
R=Path(__file__).resolve().parents[1];MODEL=R/'content_sources/translation-model';OUT=R/'assets/content/portuguese.sqlite'
db=sqlite3.connect(OUT);db.execute('PRAGMA journal_mode=DELETE')
db.executescript('CREATE TABLE IF NOT EXISTS translations(type TEXT,id TEXT,title TEXT,gloss TEXT,body TEXT,status TEXT,source TEXT,PRIMARY KEY(type,id));CREATE TABLE IF NOT EXISTS translation_cache(hash TEXT PRIMARY KEY,body TEXT);CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT);')
source=sentencepiece.SentencePieceProcessor(model_file=str(MODEL/'source.spm'));target=sentencepiece.SentencePieceProcessor(model_file=str(MODEL/'target.spm'))
translator=ctranslate2.Translator(str(MODEL/'ct2'),device='cpu',compute_type='int8',inter_threads=1,intra_threads=6)
def pieces(text):
 result=[]
 for paragraph in text.split('\n'):
  if not paragraph.strip():result.append('');continue
  # Keep short paragraphs; break long prose at sentence boundaries first.
  for sentence in re.split(r'(?<=[.!?;])\s+(?=[A-ZÀ-Ý0-9])',paragraph):
   tokens=source.encode(sentence,out_type=str)
   if len(tokens)<=210:result.append(sentence)
   else:
    words=sentence.split();part=[]
    for word in words:
     part.append(word)
     if len(source.encode(' '.join(part),out_type=str))>=180:result.append(' '.join(part));part=[]
    if part:result.append(' '.join(part))
 return result
def convert(texts):
 values={};missing=[]
 for text in dict.fromkeys(texts):
  if not text.strip():values[text]='';continue
  key=hashlib.sha256(text.encode()).hexdigest();row=db.execute('SELECT body FROM translation_cache WHERE hash=?',(key,)).fetchone()
  if row:values[text]=row[0]
  else:missing.append((text,key))
 for start in range(0,len(missing),48):
  batch=missing[start:start+48];tokens=[['>>pob<<']+source.encode(text,out_type=str)+['</s>'] for text,key in batch]
  output=translator.translate_batch(tokens,beam_size=1,max_batch_size=8000,batch_type='tokens',max_decoding_length=420)
  for (text,key),result in zip(batch,output):
   value=target.decode([token for token in result.hypotheses[0] if token not in ['</s>','>>pob<<','>>por<<']])
   value=re.sub(r'^\s*(?:>>pob\s*[⁇<]*|Pob\s*[–-])\s*','',value)
   values[text]=value;db.execute('INSERT OR REPLACE INTO translation_cache VALUES(?,?)',(key,value))
  db.commit()
 return [values[t] for t in texts]
def translate_rows(kind,rows):
 pending=[r for r in rows if not db.execute('SELECT 1 FROM translations WHERE type=? AND id=?',(kind,r['id'])).fetchone()]
 print('QUEUED',kind,len(pending),flush=True);begin=time.time()
 for offset in range(0,len(pending),12):
  batch=pending[offset:offset+12];allparts=[];ranges=[]
  for row in batch:
   title=row.get('title','');gloss=row.get('gloss','');body=row['body'];parts=pieces(body)
   start=len(allparts);allparts += [title,gloss]+parts;ranges.append((row,start,len(allparts)))
  translated=convert(allparts)
  for row,start,end in ranges:
   db.execute('INSERT OR REPLACE INTO translations VALUES(?,?,?,?,?,?,?)',(kind,row['id'],translated[start],translated[start+1],'\n'.join(translated[start+2:end]),'Tradução de apoio em português; revisão especializada pendente.','Texto histórico em domínio público. OPUS-MT Helsinki-NLP, eng–pob, 2022, CC BY 4.0.'))
  db.commit()
  if offset%120==0 or offset+12>=len(pending):
   print('PROGRESS',kind,min(offset+12,len(pending)),'/',len(pending),'seconds',round(time.time()-begin),flush=True)
   (R/'assets/content/portuguese.sha256').write_text(hashlib.sha256(OUT.read_bytes()).hexdigest())
cat=sqlite3.connect(R/'assets/content/catalogue.sqlite');cat.row_factory=sqlite3.Row
documents=[]
for r in cat.execute("SELECT * FROM documents WHERE module_id IN ('WCF','WSC','WLC') ORDER BY module_id,id"):
 text=r['body'].split('Original histórico em inglês (1647)',1)[-1].strip()
 documents.append(dict(id=r['id'],title=r['title'],body=text))
translate_rows('document',documents)
lex=sqlite3.connect(R/'assets/content/lexicon.sqlite');lex.row_factory=sqlite3.Row
translate_rows('lexeme',[dict(id=r['id'],gloss=r['gloss'],body=r['definition']) for r in lex.execute('SELECT * FROM lexemes ORDER BY id')])
library=sqlite3.connect(R/'assets/content/library.sqlite');library.row_factory=sqlite3.Row
translate_rows('commentary',[dict(id=r['id'],title=r['title'],body=r['body']) for r in library.execute("SELECT * FROM commentary_entries WHERE module_id IN ('MHCC','Barnes','CalvinCommentaries') ORDER BY CASE module_id WHEN 'MHCC' THEN 0 ELSE 1 END,start_key")])
# Selected major exegetical works get Portuguese study text first.
import zipfile
with zipfile.ZipFile(R/'assets/bundled/CalvinCommentaries.biblepkg') as z:
 calvin=json.loads(z.read('data.json'))
selected=[dict(id='CalvinCommentaries:'+row['id'],title='João Calvino',body=row['body']) for row in calvin if int(row['reference'].split(':')[0]) in [43,45,48,49]]
translate_rows('commentary',selected)

# Deliberate editorial gloss overrides: original definitions remain inspectable.
glosses={'G2316':'Deus; divindade','G2424':'Jesus','G5547':'Cristo; ungido','G26':'amor','G25':'amar','G5485':'graça; favor','G4102':'fé; confiança','G1343':'justiça','G4982':'salvar; preservar','G3962':'pai','G4151':'espírito; sopro','G3056':'palavra; discurso','G2889':'mundo; ordem','G2222':'vida','G225':'verdade','G264':'pecar; errar o alvo','G266':'pecado','H430':'Deus; deuses, conforme o contexto','H3068':'YHWH; SENHOR','H1254':'criar','H7225':'princípio; início','H1285':'aliança','H7965':'paz; integridade; bem-estar','H2617':'bondade; lealdade; amor fiel'}
for id,value in glosses.items():
 candidates=[id,id[0]+id[1:].zfill(4)];db.execute('UPDATE translations SET gloss=? WHERE type=? AND id IN (?,?)',(value,'lexeme',*candidates))
metadata=dict(model='Helsinki-NLP/opus-mt-tc-big-en-pt',target='pob',license='CC BY 4.0',source='https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-pt',publication='Tiedemann and Thottingal, OPUS-MT, EAMT 2020. https://aclanthology.org/2020.eamt-1.61/',review='Study translations pending specialist review; consult the unchanged original. Not an official IPB translation. No Bible edition is machine translated.')
db.executemany('INSERT OR REPLACE INTO metadata VALUES(?,?)',[(k,json.dumps(v)) for k,v in metadata.items()]);db.commit();db.execute('DROP TABLE translation_cache');db.execute('VACUUM');db.close()
(R/'assets/content/portuguese.sha256').write_text(hashlib.sha256(OUT.read_bytes()).hexdigest())
(R/'assets/licenses/PORTUGUESE-STUDY-TRANSLATIONS.md').write_text('# Traduções de apoio em português\n\nRecursos históricos em domínio público: Strong, Matthew Henry, Albert Barnes e originais de Westminster. Os textos de origem permanecem acessíveis. Traduções de estudo aguardam revisão linguística e teológica especializada; não são versões oficiais da IPB.\n\nProcessamento local durante a preparação do conteúdo com OPUS-MT Helsinki-NLP, eng–pob (2022), CC BY 4.0. https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-pt\n\nTiedemann, J.; Thottingal, S. (2020). OPUS-MT — Building open translation services for the World. https://aclanthology.org/2020.eamt-1.61/\n\nNenhuma tradução bíblica foi criada ou alterada por este processamento. As traduções de apoio não substituem a verificação do contexto ou do original.\n')
print('COMPLETE',flush=True)
