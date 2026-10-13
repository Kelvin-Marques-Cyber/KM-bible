#!/usr/bin/env python3
"""Verificacao de integridade dos panoramas impessoais do KM-bible."""
from __future__ import annotations
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets" / "apologetica"
index = json.loads((folder / "index.json").read_text(encoding="utf-8"))
records = index["profiles"]
assert index["scope"] == "apologetica_impessoal"
assert len(records) == 30, f"Esperados 30 panoramas, encontrados {len(records)}"
ids = set()
for profile in records:
    ident = profile["id"]
    assert ident not in ids, f"Tradicao repetida: {ident}"
    ids.add(ident)
    text = (folder / profile["file"]).read_text(encoding="utf-8")
    assert text.count("\n## ") >= 8, f"Secoes incompletas: {ident}"
    assert len(text) >= 5000, f"Menos de 5000 caracteres: {ident}: {len(text)}"
    assert abs(len(text) - profile["characters"]) <= 2, f"Contagem desatualizada: {ident}"
    assert "## Fontes" in text, f"Fontes nao catalogadas: {ident}"
    assert profile["type"] == "editorial_impessoal"
    assert not any(x in text for x in ("**Tese da apologética presbiteriana**",
         "**Objeção relevante e resposta responsável**",
         "## Refutação da tradição selecionada")), ident
print(f"OK: {len(records)} tradicoes, todos com >= 5000 caracteres, "
      "8 temas e fontes. Sem refutacao na leitura impessoal.")
