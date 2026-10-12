"""Snapshot a live translation build safely, add editorial glosses and local FTS.

The source build remains untouched, allowing continued preparation. The app
receives only finished records, with original sources and pending-review labels.
"""
import argparse,hashlib,json,os,sqlite3,tempfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--source',required=True);a=p.parse_args()
handle,name=tempfile.mkstemp(suffix='.sqlite',prefix='portuguese-final-');os.close(handle)
source=sqlite3.connect('file:'+str(Path(a.source).resolve())+'?mode=ro',uri=True)
db=sqlite3.connect(name);source.backup(db);source.close()
db.execute('DROP TABLE IF EXISTS translation_cache')
overrides={'G2316':'Deus; divindade','G2424':'Jesus','G5547':'Cristo; ungido','G26':'amor','G25':'amar','G5485':'graça; favor','G4102':'fé; confiança','G1343':'justiça','G4982':'salvar; preservar','G3962':'pai','G4151':'espírito; sopro','G3056':'palavra; discurso','G2889':'mundo; ordem','G2222':'vida','G225':'verdade','G266':'pecado','H430':'Deus; deuses, conforme o contexto','H3068':'YHWH; SENHOR','H1254':'criar','H7225':'princípio; início','H1285':'aliança','H7965':'paz; integridade; bem-estar','H2617':'bondade; lealdade; amor fiel'}
for id,gloss in overrides.items():
 db.execute("UPDATE translations SET gloss=? WHERE type='lexeme' AND id=?",(gloss,id))
for id,body in {
 'WSC.1':'**Pergunta 1. Qual é o propósito principal do ser humano?**\n\nSeu propósito principal é glorificar a Deus e desfrutar dele para sempre.',
 'WLC.1':'**Pergunta 1. Qual é o propósito principal e supremo do ser humano?**\n\nSeu propósito principal e supremo é glorificar a Deus e desfrutar plenamente dele para sempre.',
}.items():
 db.execute("UPDATE translations SET body=?,status=? WHERE type='document' AND id=?",(body,'Tradução de estudo do original histórico. Não é uma edição oficial da IPB.',id))
db.execute('DROP TABLE IF EXISTS translation_search')
db.execute("CREATE VIRTUAL TABLE translation_search USING fts5(type UNINDEXED,id UNINDEXED,title,gloss,body,tokenize='unicode61 remove_diacritics 2')")
db.execute('INSERT INTO translation_search SELECT type,id,title,gloss,body FROM translations')
db.execute("INSERT OR REPLACE INTO metadata VALUES('review',?)",(json.dumps('Traduções de apoio para estudo; revisão especializada pendente. Originais preservados. Nenhuma tradução bíblica alterada.'),))
db.commit();db.execute('VACUUM')
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
counts=dict(db.execute('SELECT type,count(*) FROM translations GROUP BY type'));db.close()
destination=R/'assets/content/portuguese.sqlite'
staging=destination.with_suffix('.sqlite.tmp');staging.write_bytes(Path(name).read_bytes());os.replace(staging,destination);os.unlink(name)
digest=hashlib.sha256(destination.read_bytes()).hexdigest()
(R/'assets/content/portuguese.sha256').write_text(digest)
(R/'assets/content/portuguese-coverage.json').write_text(json.dumps(dict(records=counts,sha256=digest,review='Revisão especializada pendente',scope='Entradas efetivamente traduzidas; originais permanecem disponíveis'),ensure_ascii=False,indent=2))
print(json.dumps(dict(records=counts,bytes=destination.stat().st_size,sha256=digest)))
