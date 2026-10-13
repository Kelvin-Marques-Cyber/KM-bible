#!/usr/bin/env python3
"""Exporta SOMENTE o acervo de Estudos do KM-bible num ZIP para revisão/importação.

Não altera o código, os SQLite, as anotações ou o conteúdo publicado.
Não inclui ARA, traduções bíblicas, assets/private, senhas ou preferências.
Conteúdos exportados são fontes de revisão; licenças devem ser verificadas
antes de redistribuir o texto na PWA pública.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import re
import sqlite3
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "assets" / "content"
BUNDLED = ROOT / "assets" / "bundled"
ORIGINALS = ROOT / "acervo-estudos-entrada"
OUTPUT = ROOT / "exportacoes"
JSON_FILES = [
    "studies.json",
    "editorial-expansion.json",
    "confessional-guides.json",
    "religion-curricula.json",
    "agostinho-confissoes-facil.json",
    "book-backgrounds.json",
    "context.json",
    "land.json",
    "material-sources.json",
    "modules.json",
    "topics-coverage.json",
    "portuguese-coverage.json",
]
TABLES = {
    "catalogue": ("content_modules", "documents", "studies"),
    "topics": ("topics", "topic_verses", "metadata"),
    "library": ("commentary_entries",),
    "portuguese": ("translations",),
}
MAX_ORIGINAL = 50 * 1024 * 1024
ALLOWED_ORIGINALS = {".pdf", ".txt", ".md", ".docx", ".epub", ".json", ".html", ".htm"}


def clean_filename(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", text)[:110]


def json_dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, default=lambda v: (
        f"<{len(v)} bytes binários omitidos>" if isinstance(v, bytes) else str(v)
    ), separators=(",", ":"))


def add_table(archive: zipfile.ZipFile, dbname: str, table: str, inventory: list[dict]):
    path = CONTENT / (dbname + ".sqlite")
    if not path.exists():
        inventory.append({"item": dbname + "." + table, "status": "banco ausente"})
        return
    # immutable=1 é só leitura e não reaplica os journals existentes.
    conn = sqlite3.connect(f"file:{path.resolve()}?mode=ro&immutable=1", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
        if not exists:
            inventory.append({"item": dbname + "." + table, "status": "tabela ausente"})
            return
        destination = f"estudos/bancos/{dbname}/{table}.jsonl"
        total = 0
        with archive.open(destination, "w") as dst:
            with io.TextIOWrapper(dst, encoding="utf-8", write_through=True) as out:
                sql = 'SELECT * FROM "' + table.replace('"', '""') + '"'
                for row in conn.execute(sql):
                    data = dict(row)
                    # Banco de traduções: exclui lexemas e material bíblico.
                    if dbname == "portuguese" and table == "translations":
                        if data.get("type") not in {"commentary", "document", "study"}:
                            continue
                    out.write(json_dump(data) + "\n")
                    total += 1
        inventory.append({"item": dbname + "." + table, "status": "ok", "registros": total})
        print(f"  {dbname}.{table}: {total} registros", flush=True)
    finally:
        conn.close()


def export():
    p = argparse.ArgumentParser(description="Exportar somente a biblioteca dos Estudos.")
    p.add_argument("--saida", type=Path, default=None, help="ZIP de saída")
    args = p.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    output = args.saida or OUTPUT / (
        "KM-bible-acervo-estudos-" + dt.date.today().strftime("%Y%m%d") + ".zip"
    )
    if output.resolve().is_relative_to(ROOT / "assets" / "private"):
        raise SystemExit("Saída não pode ficar em assets/private.")
    output.parent.mkdir(parents=True, exist_ok=True)
    inventory: list[dict] = []
    print("Exportando SOMENTE o acervo da área Estudos…", flush=True)

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6,
                         allowZip64=True) as z:
        for name in JSON_FILES:
            path = CONTENT / name
            if path.is_file():
                z.write(path, "estudos/catalogos/" + name)
                inventory.append({"item": name, "status": "ok", "bytes": path.stat().st_size})
        for dbname, tables in TABLES.items():
            for table in tables:
                add_table(z, dbname, table, inventory)
        modules_index = BUNDLED / "modules.json"
        if modules_index.is_file():
            z.write(modules_index, "estudos/modulos/modules.json")
        for package in sorted(BUNDLED.glob("*.biblepkg")):
            try:
                with zipfile.ZipFile(package) as package_zip:
                    manifest = json.loads(package_zip.read("manifest.json"))
                    kind = str(manifest.get("kind", "")).lower()
                    if kind in {"bible", "lexicon"} or manifest.get("id", "").upper() == "ARA":
                        continue
                    bodyfile = "data.json"
                    records = package_zip.read(bodyfile)
                    base = "estudos/modulos/" + clean_filename(str(manifest.get("id") or package.stem))
                    z.writestr(base + "/manifest.json", json_dump(manifest))
                    z.writestr(base + "/" + bodyfile, records)
                    inventory.append({
                        "item": "modulo:" + str(manifest.get("id")),
                        "tipo": kind, "status": "ok",
                        "bytes": len(records), "licenca": manifest.get("license"),
                        "origem": manifest.get("source"),
                    })
                    print(f"  Módulo: {manifest.get('title',package.stem)}", flush=True)
            except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
                inventory.append({"item": package.name, "status": "erro", "erro": str(exc)})
        # Os 13 livros integrais aparecem somente se a extração do PDF deu certo.
        agostinho = ROOT / "assets" / "agostinho"
        manifest = agostinho / "manifest.json"
        if manifest.is_file():
            z.write(manifest, "estudos/agostinho/manifest.json")
            for number in range(1, 14):
                file = agostinho / f"{number}.json"
                if file.is_file():
                    z.write(file, "estudos/agostinho/" + file.name)
                else:
                    inventory.append({"item": f"Agostinho livro {number}", "status": "ausente"})
        # Arquivo fonte fica no ZIP para revisar limites dos capítulos sem rebaixá-lo.
        original_pdf = ROOT / ".cache" / "agostinho" / "confissoes-solus-agape.pdf"
        if original_pdf.is_file():
            z.write(original_pdf, "estudos/originais/agostinho/confissoes-solus-agape.pdf")
            inventory.append({"item": "PDF original Agostinho", "status": "incluído"})
        for diagnostic in sorted((ROOT / ".cache" / "agostinho").glob("diagnostico-livro-*.txt")):
            z.write(diagnostic, "estudos/originais/agostinho/" + diagnostic.name)
        # Outros livros fornecidos legitimamente pelo usuário, sem misturar com notas.
        if ORIGINALS.exists():
            for file in sorted(ORIGINALS.rglob("*")):
                if not file.is_file() or file.suffix.lower() not in ALLOWED_ORIGINALS:
                    continue
                if file.stat().st_size > MAX_ORIGINAL:
                    inventory.append({"item": file.name, "status": "excede 50 MB"})
                    continue
                z.write(file, "estudos/originais/adicionais/" +
                        str(file.relative_to(ORIGINALS)).replace("\\", "/"))
                inventory.append({"item": "original:" + file.name, "status": "incluído"})
        z.writestr("LEIA-ME.txt",
            "KM-bible — Exportação de ACERVO DOS ESTUDOS, somente.\n"
            "O ZIP reúne documentos, estudos, currículos religiosos, comentários e fontes.\n"
            "Não contém bibliotecas pessoais, anotações, traduções bíblicas ou ARA.\n"
            "Textos em outras línguas não foram traduzidos automaticamente.\n"
            "Alguns documentos podem ter direitos reservados: conferir autor, edição e licença\n"
            "ANTES da redistribuição pública na PWA. Resumos não são textos originais.\n"
            "A presença do PDF de Agostinho NÃO significa que seus capítulos tenham sido validados.\n"
            "Envie este ZIP ao ChatGPT para revisar e integrar somente à aba Estudos.\n")
        z.writestr("INVENTARIO.json", json.dumps({
            "projeto": "KM-bible", "escopo": "APENAS_ACERVO_ESTUDOS",
            "gerado_em": dt.datetime.now(dt.timezone.utc).isoformat(),
            "entradas": inventory,
        }, ensure_ascii=False, indent=2))
    print(f"\nZIP pronto: {output.resolve()}", flush=True)
    print(f"Tamanho: {output.stat().st_size / (1024**2):.1f} MB", flush=True)
    print("Envie o arquivo ZIP nesta conversa. NÃO envie bancos ou dados pessoais.", flush=True)


if __name__ == "__main__":
    export()
