#!/usr/bin/env python3
"""Impede publicacao de Agostinho com artefatos do PDF ou indice no ultimo livro."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
assets = ROOT / "assets" / "agostinho"
manifest = json.loads((assets / "manifest.json").read_text(encoding="utf-8"))
assert manifest["chapterCount"] == 278
assert len(manifest["chapterCounts"]) == 13
count = 0
for book in range(1, 14):
    data = json.loads((assets / f"{book}.json").read_text(encoding="utf-8"))
    assert data["book"] == book
    assert len(data["chapters"]) == manifest["chapterCounts"][book-1]
    for i, chapter in enumerate(data["chapters"], 1):
        count += 1
        assert chapter["chapter"] == i, f"Ordem: {book}.{i}"
        assert chapter.get("layout_version") == 3, f"Layout nao convertido: {book}.{i}"
        assert len(chapter["title"].strip()) >= 3, f"Titulo ausente: {book}.{i}"
        body = chapter["body"]
        assert len(body) >= 200, f"Corpo truncado: {book}.{i}"
        assert "Santo Agostinho – Confissões." not in body, f"Cabecalho: {book}.{i}"
        assert "\n_______" not in body, f"Marcador de pagina: {book}.{i}"
        assert not re.search(r"(?m)^\d{3}$", body), f"Numero de pagina: {book}.{i}"
        assert isinstance(chapter.get("footnotes"), list)
last = json.loads((assets / "13.json").read_text(encoding="utf-8"))["chapters"][-1]
assert len(last["body"]) < 8000, "Livro XIII.38 ainda contem o indice da edicao"
assert "Solus Ágape" not in last["body"], "Publicidade misturada ao texto integral"
assert count == 278
print(f"OK Agostinho: {count} capitulos, titulos separados, texto legivel e notas identificadas.")
