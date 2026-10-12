"""Verify chapter numbering and sampled text against the user's PDF, without redistribution."""
import hashlib,json,re,sqlite3,sys,zipfile
from pathlib import Path
import fitz
R=Path(__file__).resolve().parents[1];pdf=fitz.open(sys.argv[1])
with zipfile.ZipFile(R/'assets/private/ara.biblepkg') as z:rows=json.loads(z.read('verses.json'));manifest=json.loads(z.read('manifest.json'))
chapters={};errors=[]
for row in rows:
 b,c,v=map(int,row['reference'].split(':'));chapters.setdefault((b,c),[]).append(v)
for key,verses in chapters.items():
 if verses!=list(range(1,max(verses)+1)):errors.append(str(key))
samples=[]
for book in range(1,67):
 verses=[r for r in rows if r['reference'].split(':')[0]==str(book)]
 for r in [verses[0],verses[len(verses)//2],verses[-1]]:
  page=r['metadata']['source_pdf_page'];source=pdf[page-1].get_text();tokens=[w.strip('.,;:!?—()') for w in r['text'].split() if len(w)>3]
  # A verse can continue on the next page; use adjacent page text for validation.
  if page<len(pdf):source+=' '+pdf[page].get_text()
  missing=[w for w in tokens if w not in source]
  if len(missing)>max(2,len(tokens)//10):errors.append(r['reference'])
  samples.append({'reference':r['reference'],'source_page':page,'matched_words':len(tokens)-len(missing),'words':len(tokens)})
db=sqlite3.connect(R/'assets/content/catalogue.sqlite');baseline={(b,c):n for b,c,n in db.execute("SELECT book,chapter,MAX(verse) FROM verses WHERE translation='BLN4' GROUP BY book,chapter")};db.close()
differences=[{'chapter':f'{b}:{c}','ARA':max(v),'KJV_based':baseline.get((b,c))} for (b,c),v in chapters.items() if max(v)!=baseline.get((b,c))]
report={'source_sha256':manifest['metadata']['source_pdf_sha256'],'books':66,'chapters':len(chapters),'verses':len(rows),'samples':samples,'numbering_differences':differences,'errors':errors,'limitations':'Verificação de marcadores e amostra de texto por livro. Não equivale a revisão editorial integral, palavra por palavra.'}
(R/'assets/private/ara-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['samples','source_sha256']}))
if errors:raise ValueError(errors)
