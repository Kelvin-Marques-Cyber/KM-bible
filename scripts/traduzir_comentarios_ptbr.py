#!/usr/bin/env python3
"""Traduz offline comentarios ainda sem versao pt no acervo, via Argos Translate.

Executar em uma maquina de compilacao antes do Flutter build; os resultados
ficam no asset portuguese.sqlite, usado igualmente no Android e Flutter Web.
Translacao automatica, nao substitui revisao humana e nao e edicao oficial.
"""
from __future__ import annotations
import argparse
import hashlib
import re
import sqlite3
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'assets' / 'content'


def translator():
    try:
        from argostranslate import package, translate
    except ImportError as ex:
        raise SystemExit(
            "Argos Translate nao encontrado. Instale em um venv:\n"
            "python3 -m venv .venv-traducao\n"
            ".venv-traducao/bin/pip install argostranslate\n"
            ".venv-traducao/bin/python scripts/traduzir_comentarios_ptbr.py"
        ) from ex
    def find():
        languages = translate.get_installed_languages()
        src = next((x for x in languages if x.code == 'en'), None)
        dst = next((x for x in languages if x.code == 'pt'), None)
        return src.get_translation(dst) if src and dst else None

    engine = find()
    if engine is None:
        print('Preparando modelo EN→PT da Argos Translate (primeira vez).')
        package.update_package_index()
        available = package.get_available_packages()
        chosen = next((x for x in available
                       if x.from_code == 'en' and x.to_code == 'pt'), None)
        if chosen is None:
            raise SystemExit('Nao encontrei modelo publico EN->PT no indice Argos.')
        package.install_from_path(chosen.download())
        engine = find()
    if engine is None:
        raise SystemExit('Falha ao inicializar modelo EN->PT da Argos.')
    return engine


def chunks(text: str, limit=1300):
    for paragraph in re.split(r'(\n\s*\n)', text):
        if not paragraph.strip():
            yield paragraph
        elif len(paragraph) <= limit:
            yield paragraph
        else:
            rest = paragraph
            while rest:
                cut = min(len(rest), limit)
                if cut < len(rest):
                    split = rest.rfind(' ', 0, cut)
                    if split > limit // 2:
                        cut = split
                yield rest[:cut]
                rest = rest[cut:]


def calvin_rows():
    package = ROOT / 'assets' / 'bundled' / 'CalvinCommentaries.biblepkg'
    if not package.is_file():
        raise SystemExit(f'Modulo original de Calvino ausente: {package}')
    with zipfile.ZipFile(package) as z:
        manifest = json.loads(z.read('manifest.json'))
        if manifest.get('id') != 'CalvinCommentaries':
            raise SystemExit('O arquivo informado nao e o modulo esperado de Calvino.')
        rows = json.loads(z.read('data.json'))
    for row in rows:
        yield ('CalvinCommentaries:' + str(row['id']),
               row.get('title', 'Comentário de João Calvino'),
               row.get('body', ''))


def run(maximum: int | None, retry_broken: bool, only_calvin: bool):
    library = CONTENT / 'library.sqlite'
    local = CONTENT / 'portuguese.sqlite'
    if not library.is_file() or not local.is_file():
        raise SystemExit('Bancos de conteudo ausentes: assets/content.')
    engine = translator()
    conn = sqlite3.connect(local)
    if only_calvin:
        # No APK/PWA original, Calvino nao esta no library.sqlite:
        # os 11.063 textos estao dentro de assets/bundled/*.biblepkg.
        rows = calvin_rows()
    else:
        conn.execute('ATTACH DATABASE ? AS original', (str(library),))
        rows = conn.execute("""
            SELECT c.id,c.title,c.body
            FROM original.commentary_entries AS c
            ORDER BY c.id
        """).fetchall()
    if maximum is not None and maximum < 1:
        raise SystemExit('--limit deve ser maior que zero')
    processed = 0
    skipped = 0
    for id, title, body in rows:
        if maximum is not None and processed >= maximum:
            break
        if not body or not body.strip():
            continue
        existing = conn.execute(
            "SELECT body FROM translations WHERE type='commentary' AND id=?",
            (id,),
        ).fetchone()
        if existing and existing[0] and (
            not retry_broken or '⁇' not in existing[0]
        ):
            skipped += 1
            continue
        parts = []
        for part in chunks(body):
            parts.append(engine.translate(part) if part.strip() else part)
        translated = ''.join(parts)
        # Nao registrar traducao vazia, danificada ou que manteve o original.
        if not translated.strip() or '⁇' in translated:
            continue
        if len(body) >= 100 and translated.strip() == body.strip():
            continue
        translated_title = (
            engine.translate(title) if title and title.strip()
            and title != 'Comentário de João Calvino' else title
        )
        conn.execute("""
            INSERT INTO translations (type,id,title,gloss,body,status,source)
            VALUES ('commentary',?,?,?,?,?,?)
            ON CONFLICT(type,id) DO UPDATE SET
               title=excluded.title,body=excluded.body,
               status=excluded.status,source=excluded.source
        """, (
            id, translated_title, '',
            translated,
            'Tradução automática de estudo — revisão necessária',
            'Argos Translate EN→PT; original no módulo de origem',
        ))
        processed += 1
        if processed % 20 == 0:
            conn.commit()
            print(f'{processed} comentarios processados (retomada segura)', flush=True)
    conn.commit()
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    conn.close()
    digest = hashlib.sha256(local.read_bytes()).hexdigest()
    (CONTENT / 'portuguese.sha256').write_text(digest + '\n', encoding='utf-8')
    db = sqlite3.connect(local)
    counts = dict(db.execute('SELECT type,count(*) FROM translations GROUP BY type'))
    translated_calvin = db.execute(
        "SELECT count(*) FROM translations WHERE type='commentary' "
        "AND id LIKE 'CalvinCommentaries:%' AND length(trim(body))>0"
    ).fetchone()[0]
    db.close()
    (CONTENT / 'portuguese-coverage.json').write_text(json.dumps({
        'records': counts,
        'calvin_translated': translated_calvin,
        'sha256': digest,
        'review': 'Tradução automática de estudo; revisão especializada pendente',
        'scope': 'Somente entradas realmente traduzidas; originais preservados',
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Calvino traduzido: {translated_calvin} entradas.', flush=True)
    print(f'Terminou: {processed} traducao(oes); {skipped} preexistentes. SHA256 atualizada.')
    print('Recompile Android e Web. Confirme licencas antes de redistribuir.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=None,
                        help='Maximo de comentarios nesta rodada, ex. 20')
    parser.add_argument('--retraduzir-danificados', action='store_true')
    parser.add_argument('--calvino', action='store_true',
                        help='Traduz os 11.063 comentarios originais de Calvino')
    args = parser.parse_args()
    run(args.limit, args.retraduzir_danificados, args.calvino)
