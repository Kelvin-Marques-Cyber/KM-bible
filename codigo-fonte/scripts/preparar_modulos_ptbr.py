#!/usr/bin/env python3
"""Acrescenta os modulos editoriais PT-BR ao build PUBLICO Android/Web.

Exemplo:
python3 scripts/preparar_modulos_ptbr.py ~/Downloads/Expansivo-PTBR-v2.zip

Sem ARA. Evita publicar conteudos de bibliotecas privadas.
"""
import io
import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]).expanduser() if len(sys.argv)>1 else Path.home()/'Downloads/Expansivo-PTBR-v2.zip'
listing=ROOT/'assets/bundled/modules.json'
outdir=ROOT/'assets/bundled'
if not archive.is_file() or not listing.is_file():
    raise SystemExit('Informe o ZIP Expansivo-PTBR-v2.zip; pasta do projeto invalida.')
entries=json.loads(listing.read_text(encoding='utf8'))
present={str(x['id']) for x in entries if isinstance(x,dict) and 'id' in x}
added=0
with zipfile.ZipFile(archive) as z:
    for item in z.infolist():
        if not item.filename.endswith('.biblepkg'):
            continue
        raw=z.read(item)
        with zipfile.ZipFile(io.BytesIO(raw)) as pkg:
            m=json.loads(pkg.read('manifest.json'))
        id=str(m.get('id',''))
        if not id or 'ara' in id.lower() or not str(m.get('language','')).lower().startswith('pt'):
            raise SystemExit('Modulo nao permitido na versao publica: '+item.filename)
        if id in present:
            continue
        filename='PTBR-'+Path(item.filename).name
        destination=outdir/filename
        if destination.exists() and destination.read_bytes()!=raw:
            raise SystemExit('Conflito com modulo ja existente: '+str(destination))
        destination.write_bytes(raw)
        entries.append({'id':id,'file':filename})
        present.add(id)
        added+=1
listing.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Modulos PT-BR acrescentados:',added)
print('O projeto continua PUBLICO e sem ARA.')
