#!/usr/bin/env python3
"""Bloqueia publicação se os módulos anunciados não estiverem realmente instalados."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets" / "content"
listing = json.loads((ROOT / "assets" / "bundled" / "modules.json").read_text())
catalogue = sqlite3.connect(folder / "catalogue.sqlite")
library = sqlite3.connect(folder / "library.sqlite")
try:
    for item in listing:
        ident = item["id"]
        status = catalogue.execute(
            "SELECT installed,builtin,kind FROM content_modules WHERE id=?", (ident,)
        ).fetchone()
        if not status or status[0] != 1 or status[1] != 1:
            raise SystemExit(f"Modulo nao pre-instalado: {ident}")
        kind = status[2]
        if kind == "bible":
            count = catalogue.execute(
                "SELECT count(*) FROM verses WHERE translation=?", (ident,)
            ).fetchone()[0]
        elif kind == "commentary":
            count = library.execute(
                "SELECT count(*) FROM commentary_entries WHERE module_id=?", (ident,)
            ).fetchone()[0]
        else:
            count = catalogue.execute(
                "SELECT count(*) FROM documents WHERE module_id=?", (ident,)
            ).fetchone()[0]
        if count <= 0:
            raise SystemExit(f"Modulo sem textos para leitura: {ident}")
        print(f"{ident}: instalado, {count} registros", flush=True)

    ara = catalogue.execute(
        "SELECT COUNT(*), COUNT(DISTINCT book), COUNT(DISTINCT book || ':' || chapter) "
        "FROM verses WHERE translation='ARA'"
    ).fetchone()
    if tuple(ara) != (31104, 66, 1189):
        raise SystemExit(f"ARA incompleta: {ara} (esperados 31104/66/1189)")
    assert len(listing) >= 17, "Faltam pacotes no catálogo de distribuição"
    print(f"OK: {len(listing)} módulos completos pré-instalados, "
          "ARA integral no SQLite. Nenhuma importação manual necessária.")
finally:
    catalogue.close()
    library.close()
