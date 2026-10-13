#!/usr/bin/env python3
"""Publicação SQLite para Flutter Web / GitHub Pages sem arquivos > 100 MB.

Depois de preparar os bancos e índices, divide SQLite grandes em partes de
16 MiB, incluídas pelo asset bundle Flutter. Depois da compilação, remove
SOMENTE do build/web as cópias SQLite grandes, já substituídas pelas partes.
Mantém os originais para o APK e as anotações pessoais intocadas.

Uso:
  python3 scripts/particionar_sqlite_web.py --preparar
  python3 scripts/particionar_sqlite_web.py --finalizar
  python3 scripts/particionar_sqlite_web.py --validar-build
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "content"
WEB = ROOT / "build" / "web" / "assets" / "assets" / "content"
INDEX_NAME = "sqlite-web-parts.json"
CHUNK_SIZE = 16 * 1024 * 1024
# Menor que o limite recomendado de 50 MB do GitHub; evita alertas de LFS.
SPLIT_AT = 45_000_000
DBS = ("catalogue", "lexicon", "library", "connections", "portuguese", "topics")


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as file:
        while part := file.read(4 * 1024 * 1024):
            result.update(part)
    return result.hexdigest()


def load_index() -> dict:
    path = SOURCE / INDEX_NAME
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("format") != 1:
        raise SystemExit(f"Manifest SQLite Web invalido: {path}")
    return value["partitioned"]


def prepare() -> None:
    # Evita deixar partes antigas de um banco após uma nova otimização.
    for old in SOURCE.glob("*.sqlite.part*.bin"):
        old.unlink()
    partitioned = {}
    for name in DBS:
        path = SOURCE / f"{name}.sqlite"
        if not path.is_file():
            raise SystemExit(f"Banco ausente: {path}")
        expected = (SOURCE / f"{name}.sha256").read_text().strip()
        actual = digest(path)
        if actual != expected:
            raise SystemExit(f"SHA-256 invalido para {name}: {actual} != {expected}")
        size = path.stat().st_size
        if size <= SPLIT_AT:
            print(f"SQLite Web: {name} ({size / 1e6:.1f} MB) mantido integral.")
            continue

        pieces = []
        total = 0
        with path.open("rb") as original:
            for index, part in enumerate(iter(lambda: original.read(CHUNK_SIZE), b"")):
                filename = f"{name}.sqlite.part{index:03d}.bin"
                output = SOURCE / filename
                output.write_bytes(part)
                pieces.append({
                    "file": filename,
                    "size": len(part),
                    "sha256": hashlib.sha256(part).hexdigest(),
                })
                total += len(part)
        if not pieces or total != size:
            raise SystemExit(f"Particao incompleta: {name}")
        partitioned[name] = {"size": size, "sha256": expected, "chunks": pieces}
        print(f"SQLite Web: {name}, {size / 1e6:.1f} MB em "
              f"{len(pieces)} partes de ate {CHUNK_SIZE // (1024*1024)} MiB.")

    (SOURCE / INDEX_NAME).write_text(json.dumps({
        "format": 1,
        "chunk_size": CHUNK_SIZE,
        "partitioned": partitioned,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Indice preparado: {len(partitioned)} bancos particionados.")


def validate_build(*, remove_originals: bool = False) -> None:
    index = load_index()
    web_index = WEB / INDEX_NAME
    if not web_index.is_file():
        raise SystemExit("Flutter Web nao incluiu o manifesto das partes SQLite.")
    bundled = json.loads(web_index.read_text(encoding="utf-8"))
    if bundled["partitioned"] != index:
        raise SystemExit("Manifest do build difere do gerado a partir dos SQLite.")

    removed = []
    for name, data in index.items():
        actual = 0
        for item in data["chunks"]:
            path = WEB / item["file"]
            if not path.is_file() or path.stat().st_size != item["size"]:
                raise SystemExit(f"Parte ausente/incompleta no bundle: {path}")
            if digest(path) != item["sha256"]:
                raise SystemExit(f"Parte corrompida: {path}")
            if path.stat().st_size > SPLIT_AT:
                raise SystemExit(f"Parte maior que limite seguro: {path}")
            actual += item["size"]
        if actual != data["size"]:
            raise SystemExit(f"Total fragmentado inconsistente: {name}")

        original = WEB / f"{name}.sqlite"
        if remove_originals and original.is_file():
            if original.stat().st_size != data["size"]:
                raise SystemExit(f"SQLite original divergente no Flutter: {original}")
            original.unlink()
            removed.append(name)
        if original.exists():
            raise SystemExit(f"SQLite duplicado ainda presente no build: {original}")

    # Verificação final contra o limite rígido do GitHub para toda a publicação.
    oversized = []
    public_root = ROOT / "build" / "web"
    for file in public_root.rglob("*"):
        if file.is_file() and file.stat().st_size >= 100_000_000:
            oversized.append(f"{file.relative_to(public_root)} ({file.stat().st_size})")
    if oversized:
        raise SystemExit("GH001: arquivos grandes remanescentes: " +
                         ", ".join(oversized))
    print("OK: bundle Web contém os bancos fragmentados, sem arquivos >= 100 MB.")
    if removed:
        print("SQLite originais removidos APENAS de build/web: " +
              ", ".join(removed))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preparar", action="store_true")
    mode.add_argument("--finalizar", action="store_true")
    mode.add_argument("--validar-build", action="store_true")
    args = parser.parse_args()
    if args.preparar:
        prepare()
    else:
        validate_build(remove_originals=args.finalizar)
