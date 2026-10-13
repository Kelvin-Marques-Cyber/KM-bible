#!/usr/bin/env python3
"""Pré-instala os módulos .biblepkg existentes no SQLite estático do build.

A PWA passa a abrir com o catálogo, as obras e os guias já disponíveis,
sem importações dos pacotes no navegador. Nunca altera personal.sqlite.
Só lê arquivos reais presentes em assets/bundled e valida SHA-256.
"""
import hashlib
import json
import sqlite3
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "assets" / "content"
PACKAGES = ROOT / "assets" / "bundled"


def encoded(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def source_package(path):
    with zipfile.ZipFile(path) as archive:
        m = json.loads(archive.read("manifest.json"))
        if m.get("format_version") != 1 or m.get("kind") not in (
            "bible", "commentary", "confession", "study", "dictionary", "atlas"
        ):
            raise ValueError(f"Tipo/versao de pacote invalido: {path.name}")
        filename = "verses.json" if m["kind"] == "bible" else "data.json"
        data = archive.read(filename)
        if hashlib.sha256(data).hexdigest() != m.get("files", {}).get(filename):
            raise ValueError(f"Hash SHA-256 divergente: {path.name}")
        records = json.loads(data)
        if not isinstance(records, list) or not records:
            raise ValueError(f"Pacote sem conteúdo: {path.name}")
        return m, records


def ref_parts(r):
    b, c, v = map(int, r.split(":"))
    if not (1 <= b <= 66 and 1 <= c <= 150 and 1 <= v <= 176):
        raise ValueError(f"Referencia invalida: {r}")
    return b, c, v


def import_one(db, m, records):
    mid, kind = m["id"], m["kind"]
    if any(s not in {x[0] for x in db.execute(
        "SELECT id FROM content_modules WHERE installed=1"
    )} for s in m.get("dependencies", [])):
        raise ValueError(f"Dependencia nao instalada: {mid}")
    db.execute("INSERT OR REPLACE INTO content_modules VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (
        mid, m["title"], kind, m["language"], m["version"], m["author"],
        m["license"], m["license_text"], m["source"], 1, 1,
        encoded(m.get("metadata", {}))
    ))
    if kind == "bible":
        db.execute("DELETE FROM verses WHERE translation=?", (mid,))
        for item in records:
            ref = item["reference"]
            book, chapter, verse = ref_parts(ref)
            db.execute("INSERT INTO verses VALUES(?,?,?,?,?,?,?)", (
                mid, ref, book, chapter, verse, item["text"],
                encoded(item.get("metadata", {}))
            ))
    elif kind == "commentary":
        db.execute("DELETE FROM library.commentary_entries WHERE module_id=?", (mid,))
        for item in records:
            a = item["reference"]
            b = item.get("end_reference", a)
            ab, ac, av = ref_parts(a)
            bb, bc, bv = ref_parts(b)
            start, end = ab*1000000+ac*1000+av, bb*1000000+bc*1000+bv
            if end < start:
                raise ValueError(f"Intervalo invertido: {mid}:{a}-{b}")
            db.execute("INSERT INTO library.commentary_entries VALUES(?,?,?,?,?,?,?,?,?,?)", (
                f"{mid}:{item['id']}", mid, a, b, start, end,
                item.get("title") or a, item["body"],
                item.get("commentary_kind", "exegesis"),
                item.get("bibliography", m["title"]),
            ))
    else:
        db.execute(
            "DELETE FROM document_search WHERE id IN "
            "(SELECT id FROM documents WHERE module_id=?)", (mid,)
        )
        db.execute("DELETE FROM documents WHERE module_id=?", (mid,))
        for item in records:
            rid = f"{mid}:{item['id']}"
            title = item.get("title") or m["title"]
            body = item.get("body") or ""
            db.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?)", (
                rid, mid, kind, title, body, item.get("reference") or "",
                encoded(item.get("metadata", {}))
            ))
            db.execute("INSERT INTO document_search VALUES(?,?,?)", (
                rid, title, body
            ))
    return len(records)


def main():
    listing = json.loads((PACKAGES / "modules.json").read_text(encoding="utf-8"))
    modules, found = [], set()
    for item in listing:
        mid, filename = item["id"], item["file"]
        if mid in found:
            raise ValueError(f"ID duplicado: {mid}")
        found.add(mid)
        package = PACKAGES / filename
        if not package.is_file():
            raise ValueError(f"Pacote declarado ausente: {package}")
        m, rows = source_package(package)
        if m["id"] != mid:
            raise ValueError(f"ID do pacote divergente: {filename}")
        modules.append((m, rows))

    db = sqlite3.connect(CONTENT / "catalogue.sqlite")
    db.execute("ATTACH DATABASE ? AS library", (str(CONTENT / "library.sqlite"),))
    try:
        db.execute("BEGIN IMMEDIATE")
        try:
            for m, rows in modules:
                count = import_one(db, m, rows)
                print(f"Pré-instalado: {m['id']} ({m['kind']}, {count} registros)", flush=True)
            db.execute("COMMIT")
        except Exception:
            db.execute("ROLLBACK")
            raise
    finally:
        db.close()

    for name in ("catalogue", "library", "lexicon"):
        source = CONTENT / f"{name}.sqlite"
        con = sqlite3.connect(source)
        try:
            if con.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError(f"Banco danificado: {name}")
        finally:
            con.close()
        (CONTENT / f"{name}.sha256").write_text(
            hashlib.sha256(source.read_bytes()).hexdigest() + "\n",
            encoding="utf-8",
        )
    print(f"OK: {len(modules)} modulos instalados nos bancos distribuidos.")


if __name__ == "__main__":
    main()
