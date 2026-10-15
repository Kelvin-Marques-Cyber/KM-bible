#!/usr/bin/env python3
"""Verificacao de integridade dos panoramas impessoais do KM-bible."""
from __future__ import annotations
import hashlib
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
# Os suplementos devem acrescentar 7000 caracteres reais por tradicao;
# os dossies da leitura reformada devem ter ao menos 7000 caracteres.
extra = ROOT / "assets" / "apologetica_extra"
reformed = ROOT / "assets" / "apologetica_reformada"
expanded = json.loads((extra / "index.json").read_text(encoding="utf-8"))
assert expanded["count"] == 30
assert len(expanded["profiles"]) == 30
editorial = json.loads((ROOT / "assets/content/apologetica-editorial.json").read_text(encoding="utf-8"))["profiles"]
assert len(editorial) == 30
fingerprints = set()
for profile in expanded["profiles"]:
    ident = profile["target"]
    assert ident in ids, f"Tradicao extra nao reconhecida: {ident}"
    base = (folder / f"{ident}.md").read_text(encoding="utf-8")
    extra_text = (extra / f"{ident}.md").read_text(encoding="utf-8")
    reformed_text = (reformed / f"{ident}.md").read_text(encoding="utf-8")
    assert len(extra_text) >= 7000, f"Suplemento impessoal curto: {ident}"
    assert len(reformed_text) >= 7000, f"Argumentacao presbiteriana curta: {ident}"
    assert len(base) + len(extra_text) >= 12000, f"Total impessoal curto: {ident}"
    assert len(extra_text) == profile["impersonal_added"]
    assert len(reformed_text) == profile["reformed_addition"]
    assert "## " in reformed_text and "## " in extra_text
    assert ident in editorial, f"Perfil editorial ausente: {ident}"
    axes = editorial[ident]["axes"]
    assert len(axes) == 8 and len(set(axes)) == 8, f"Eixos repetidos: {ident}"
    for axis in axes:
        assert axis in reformed_text, f"Eixo específico omitido: {ident}"
    assert reformed_text.count("\n## ") >= 10, f"Seções confessionais incompletas: {ident}"
    fingerprint = hashlib.sha256(reformed_text.encode()).hexdigest()
    assert fingerprint not in fingerprints, f"Dossiê duplicado: {ident}"
    fingerprints.add(fingerprint)
print(f"OK: {len(records)} tradicoes, >=5000 base + >=7000 impessoal "
      "adicional e >=7000 caracteres de argumentacao reformada; "
      "materiais conferidos por tradicao.")
