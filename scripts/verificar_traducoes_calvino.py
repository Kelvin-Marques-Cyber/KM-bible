#!/usr/bin/env python3
"""Confere se cada entrada historica de Calvino possui traducao completa em pt-BR.

Falha antes de publicar uma compilacao com comentarios ainda em ingles.
"""
import json
import sqlite3
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
original = root / "assets/bundled/CalvinCommentaries.biblepkg"
translated = root / "assets/content/portuguese.sqlite"
if not original.exists() or not translated.exists():
    sys.exit("Falta o modulo original ou o banco de traducoes de Calvino.")

with zipfile.ZipFile(original) as archive:
    manifest = json.loads(archive.read("manifest.json"))
    if manifest.get("id") != "CalvinCommentaries":
        sys.exit("Modulo de Calvino inesperado.")
    rows = json.loads(archive.read("data.json"))
expected = {"CalvinCommentaries:" + str(row["id"]) for row in rows
            if str(row.get("body", "")).strip()}
with sqlite3.connect(f"file:{translated}?mode=ro", uri=True) as db:
    translations = dict(db.execute(
        "SELECT id,body FROM translations WHERE type='commentary' "
        "AND id LIKE 'CalvinCommentaries:%' AND length(trim(body))>0"
    ))
originals = {"CalvinCommentaries:" + str(row["id"]): str(row.get("body", "")).strip()
             for row in rows if str(row.get("body", "")).strip()}
present = {id for id, body in translations.items()
           if id in expected and body.strip()
           and body.strip() != originals[id] and '⁇' not in body}
missing = expected - present
print(f"Traducoes de Calvino validadas: {len(expected) - len(missing)}/{len(expected)}")
if missing:
    print("Primeiras entradas sem traducao:", ", ".join(sorted(missing)[:5]))
    sys.exit("Acervo de Calvino ainda sem traducao integral; compilacao bloqueada.")
print("OK: comentarios de Calvino possuem traducoes para o build.")
