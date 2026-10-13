"""Read-only verification of the local cross-reference source for the app."""
from pathlib import Path
import hashlib
import sqlite3

root = Path(__file__).resolve().parents[1]
db = root / 'assets/content/connections.sqlite'
checksum = root / 'assets/content/connections.sha256'
if not db.is_file():
    raise SystemExit('ERRO: connections.sqlite ausente')
if not checksum.is_file():
    raise SystemExit('ERRO: connections.sha256 ausente')
expected = checksum.read_text(encoding='utf-8').strip()
actual = hashlib.sha256(db.read_bytes()).hexdigest()
print('Banco de referências:', db)
print('Integridade SHA-256:', 'OK' if expected == actual else 'FALHOU')
if expected != actual:
    raise SystemExit('ERRO: o banco não corresponde ao checksum; restaure o arquivo do ZIP original')
# immutable prevents rollback/sidecar journals from mutating the file.
conn = sqlite3.connect(db.as_uri() + '?mode=ro&immutable=1', uri=True)
try:
    count = conn.execute('SELECT COUNT(*) FROM cross_references').fetchone()[0]
    source = conn.execute('SELECT COUNT(*) FROM cross_references WHERE source=?', ('43:3:16',)).fetchone()[0]
finally:
    conn.close()
print('Referências cruzadas totais:', count)
print('Referências diretas de João 3:16:', source)
if count < 100_000 or source == 0:
    raise SystemExit('ERRO: a base está vazia ou incompleta')
print('Banco de dados OK; teste a interface no celular.')
