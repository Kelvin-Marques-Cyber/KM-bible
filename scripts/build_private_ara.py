"""Convert the user's licensed RA PDF into an isolated personal content package.

The PDF and generated package are excluded from the source repository.
"""
import hashlib,json,re,sys,unicodedata,zipfile
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parents[1]
def fold(s):return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn').replace(' ','')
pdf=Path(sys.argv[1]);doc=fitz.open(pdf);toc=doc.get_toc()
start=next(i for i,e in enumerate(toc) if e[1]=='Gênesis');book_toc=toc[start:start+66]
assert book_toc[-1][1]=='Apocalipse'
book_pages={e[2]-1:i+1 for i,e in enumerate(book_toc)}
end=toc[start+66][2]-1;book=0;chapter=0;active=None;note=None;notes_mode=False
records={};notes={};pending=[]
RED=0xA50805
def add_text(text,color):
 if not active or not text:return
 rec=records[active];begin=len(rec['raw']);rec['raw']+=text
 if ((color>>16)&255)>130 and ((color>>8)&255)<70 and (color&255)<70:rec['red'].append([begin,begin+len(text)])
for page_number in range(book_toc[0][2]-1,end):
 if page_number in book_pages:
  book=book_pages[page_number];chapter=0;active=None;notes_mode=False;note=None;pending=[]
 blocks=doc[page_number].get_text('dict',sort=True)['blocks']
 for block in blocks:
  for line in block.get('lines',[]):
   spans=line['spans'];whole=''.join(s['text'] for s in spans).strip()
   note_match=re.match(r'^†\s*(\d+)\.(\d+)(?:-(\d+))?\s*(.*)',whole)
   if note_match:
    notes_mode=True;active=None;c,v=int(note_match[1]),int(note_match[2]);last=int(note_match[3] or v);note=(book,c,v,last);notes[note]=notes.get(note,'')+note_match[4];continue
   if notes_mode:
    if note:notes[note]+=' '+whole
    continue
   heading=next((s for s in spans if abs(s['size']-21)<0.1 and 'Bold' in s['font']),None)
   if heading:
    m=re.search(r' (\d+)\s*$',whole)
    if m:
     chapter=int(m[1]);active=None;pending=[];continue
   if not chapter:
    if book in {31,57,63,64,65} and any(abs(s['size']-14.25)<0.1 and 'Bold' in s['font'] and s['color']==6368657 and re.fullmatch(r'\d+\s*',s['text']) for s in spans):chapter=1;pending=[]
    else:continue
   if spans and all(s['color']==4129910 for s in spans):
    pending.append(whole);continue
   if active and records[active]['raw'] and not records[active]['raw'].endswith((' ','\n')):add_text(' ',0)
   for s in spans:
    text=s['text']
    if abs(s['size']-14.25)<0.1 and 'Bold' in s['font'] and s['color']==6368657 and re.fullmatch(r'\d+\s*',text):
     number=int(text);active=f'{book}:{chapter}:{number}'
     if active in records:raise ValueError('Duplicate verse marker '+active)
     records[active]={'reference':active,'raw':'','red':[],'heading':' '.join(pending),'paragraph':not(s['flags']&1),'page':page_number+1};pending=[]
    elif active and text.strip()!='†' and s['color'] not in (6368657,4129910):add_text(text,s['color'])
 if page_number%300==0:print('PDF pages',page_number+1,'verses',len(records),flush=True)
verses=[];empty=[]
for r,rec in records.items():
 raw=rec.pop('raw');left=len(raw)-len(raw.lstrip());text=raw.strip()
 if not text:empty.append(r);continue
 red=[]
 for a,b in rec.pop('red'):
  a=max(0,a-left);b=min(len(text),b-left)
  if a<b:
   if red and a<=red[-1][1]:red[-1][1]=max(red[-1][1],b)
   else:red.append([a,b])
 meta={'heading':rec['heading'],'paragraph':rec['paragraph'],'red_ranges':red,'source_pdf_page':rec['page'],'notes':[]}
 verses.append({'reference':r,'text':text,'metadata':meta})
lookup={v['reference']:v for v in verses}
for (b,c,start,last),text in notes.items():
 for n in range(start,last+1):
  r=f'{b}:{c}:{n}'
  if r in lookup:lookup[r]['metadata']['notes'].append(text.strip())
# Complete chapter sequences and marker order must be intact before packaging.
chapters={}
for v in verses:
 b,c,n=map(int,v['reference'].split(':'));chapters.setdefault((b,c),[]).append(n)
errors=[]
for (b,c),numbers in chapters.items():
 if numbers!=list(range(1,max(numbers)+1)):errors.append([b,c,numbers])
coverage={b:sorted(c for bk,c in chapters if bk==b) for b in range(1,67)}
for b,cs in coverage.items():
 if not cs or cs!=list(range(1,max(cs)+1)):errors.append(['chapters',b,cs])
report={'source_pdf_sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'verses':len(verses),'books':len(coverage),'chapters':len(chapters),'empty':empty,'sequence_errors':errors,'red_verses':sum(bool(v['metadata']['red_ranges']) for v in verses),'notes':len(notes),'coverage':coverage}
(ROOT.parent/'research/ara-extraction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if errors or empty or len(chapters)!=1189:raise ValueError('Extraction needs correction; see report')
payload=json.dumps(verses,ensure_ascii=False,separators=(',',':')).encode()
manifest={'format_version':1,'id':'ARA','version':'1993.2010.personal.2','kind':'bible','language':'pt','title':'Almeida Revista e Atualizada — RA','author':'João Ferreira de Almeida; Sociedade Bíblica do Brasil','license':'Direitos reservados — autorização pessoal do usuário','license_text':'Almeida Revista e Atualizada, 2ª edição (1993); © 2010 Sociedade Bíblica do Brasil. Todos os direitos reservados. PDF fornecido pelo usuário, que declarou autorização para uso pessoal, sem compartilhamento com outras pessoas. Esta autorização não é uma licença de redistribuição.','source':'PDF fornecido pelo usuário; ISBN 978-85-311-1535-6; Sociedade Bíblica do Brasil','mappings':[{'source_reference':'47:13:13','target_translation':'BLN4','target_reference':'47:13:14','kind':'editorial_verified'}],'dependencies':[],'min_app_version':'0.1.0','files':{'verses.json':hashlib.sha256(payload).hexdigest()},'metadata':{'versification':'ARA1993','personal_use_only':True,'source_pdf_sha256':report['source_pdf_sha256'],'source_pdf_title':doc.metadata.get('title'),'extraction_report':{k:v for k,v in report.items() if k not in ('coverage','sequence_errors')}}}
out=ROOT/'assets/private/ara.biblepkg';out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False));z.writestr('verses.json',payload)
(out.parent/'modules.json').write_text('["ara.biblepkg"]\n')
print('Verified personal RA',len(verses),'verses',out.stat().st_size,'bytes',flush=True)
