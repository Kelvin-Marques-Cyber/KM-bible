#!/usr/bin/env python3
"""Divide os 11.063 comentarios de Calvino por livro para carregamento sob demanda.

O Flutter Web no celular nao deve descompactar o arquivo completo na inicializacao.
As traducoes ficam separadas em portuguese.sqlite, obtidas pelo Argos no build.
"""
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package = root / 'assets/bundled/CalvinCommentaries.biblepkg'
output = root / 'assets/calvino-por-livro'
if not package.is_file():
    raise SystemExit('Modulo publico de Calvino nao encontrado.')
with zipfile.ZipFile(package) as z:
    manifest = json.loads(z.read('manifest.json'))
    assert manifest['id'] == 'CalvinCommentaries'
    entries = json.loads(z.read('data.json'))

books = {book: [] for book in range(1, 67)}
for row in entries:
    reference = str(row.get('reference', ''))
    pieces = reference.split(':')
    if len(pieces) != 3 or not pieces[0].isdigit():
        continue
    book = int(pieces[0])
    if book not in books:
        continue
    books[book].append({
        'id': 'CalvinCommentaries:' + str(row['id']),
        'reference': reference,
        'end_reference': row.get('end_reference') or reference,
        'title': row.get('title') or 'Comentário de João Calvino',
        'body': row.get('body') or '',
        'kind': row.get('commentary_kind', 'exegesis'),
    })
output.mkdir(exist_ok=True)
for book, rows in books.items():
    (output / f'{book}.json').write_text(
        json.dumps(rows, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8'
    )
print('Calvino separado por 66 livros:', len(entries), 'entradas. Sem conversao no aparelho.')
