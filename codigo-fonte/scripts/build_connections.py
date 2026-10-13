"""Build an indexed offline cross-reference resource; no copyrighted Bible text."""
import csv, hashlib, io, json, sqlite3, urllib.request, zipfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]; S=R/'content_sources'; S.mkdir(exist_ok=True)
URL='https://a.openbible.info/data/cross-references.zip'; p=S/'cross-references.zip'
if not p.exists(): p.write_bytes(urllib.request.urlopen(URL, timeout=45).read())
names='Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split()
books={v:i+1 for i,v in enumerate(names)}
def ref(s):
 a,b,c=s.split('.'); return f'{books[a]}:{int(b)}:{int(c)}'
cat=sqlite3.connect(R/'assets/content/catalogue.sqlite')
valid={r[0] for r in cat.execute("SELECT reference FROM verses WHERE translation='BLN4'")};cat.close()
out=R/'assets/content/connections.sqlite';out.unlink(missing_ok=True);d=sqlite3.connect(out)
d.executescript('CREATE TABLE cross_references(source TEXT,target TEXT,end_reference TEXT,priority INTEGER,kind TEXT,provenance TEXT,PRIMARY KEY(source,target,end_reference));CREATE INDEX cross_refs_source ON cross_references(source,priority DESC);CREATE INDEX cross_refs_target ON cross_references(target,priority DESC);CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);')
with zipfile.ZipFile(p) as z: data=z.read('cross_references.txt').decode('utf-8-sig')
rejected=0
for row in csv.DictReader(io.StringIO(data),delimiter='\t'):
 try:
  source=ref(row['From Verse']); start,*tail=row['To Verse'].split('-');target=ref(start);end=ref(tail[0]) if tail else target
  if any(v not in valid for v in (source,target,end)): rejected+=1;continue
  d.execute('INSERT OR IGNORE INTO cross_references VALUES(?,?,?,?,?,?)',(source,target,end,int(row['Votes']),'editorial','OpenBible.info / Treasury of Scripture Knowledge'))
 except (KeyError,ValueError): rejected+=1
count=d.execute('SELECT count(*) FROM cross_references').fetchone()[0]
metadata=dict(source=URL,license='CC BY 4.0',license_url='https://creativecommons.org/licenses/by/4.0/',rows=count,rejected_unmapped=rejected,basis='BLN4 / KJV canonical references',methodology='Editorial references, principally Treasury of Scripture Knowledge. Votes order retrieval; they are not exegetical authority. Ranges preserved; unavailable numeric addresses excluded.')
d.executemany('INSERT INTO metadata VALUES(?,?)',[(k,json.dumps(v,ensure_ascii=False)) for k,v in metadata.items()]);d.commit();d.execute('VACUUM');d.close()
(R/'assets/content/connections.sha256').write_text(hashlib.sha256(out.read_bytes()).hexdigest())
(R/'assets/content/connection-sources.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
(R/'assets/licenses/CROSS-REFERENCES.md').write_text('# Referências cruzadas\n\nOpenBible.info, principalmente Treasury of Scripture Knowledge. Fonte: '+URL+'\n\nCC BY 4.0 — https://creativecommons.org/licenses/by/4.0/\n\nAdaptações: normalização de identificadores, índices locais, conservação de intervalos, exclusão de endereços não mapeados. Votos apenas ordenam a consulta. As relações são editoriais, não equivalência textual nem prova automática de uma interpretação. Não contém texto ESV. As edições bíblicas consultadas têm suas próprias licenças.\n')
print(json.dumps(metadata),flush=True)
