#!/usr/bin/env python3
"""Prepara os artefatos editoriais ignorados pelo Git antes do build da PWA.

Um clone novo não contém assets/apologetica_reformada/*.md nem os JSONs
normalizados de Agostinho. Não publique um catálogo parcial silenciosamente.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
CONTENT = ASSETS / "content"


def missing_content(root: Path = ROOT) -> list[str]:
    assets = root / "assets"
    missing: list[str] = []
    profiles_file = assets / "content" / "apologetica-editorial.json"
    try:
        profiles = json.loads(profiles_file.read_text(encoding="utf-8"))["profiles"]
        if not isinstance(profiles, dict) or len(profiles) != 30:
            return ["catálogo editorial com 30 tradições ausente ou inválido"]
    except (OSError, ValueError, KeyError, TypeError):
        return ["catálogo editorial de apologética ausente ou inválido"]

    for target, profile in sorted(profiles.items()):
        path = assets / "apologetica_reformada" / f"{target}.md"
        try:
            body = path.read_text(encoding="utf-8")
            axes = profile["axes"]
            if len(body) < 7000 or not isinstance(axes, list) or not all(
                isinstance(axis, str) and axis in body for axis in axes
            ):
                missing.append(f"dossiê incompleto: {target}")
        except (OSError, KeyError, TypeError):
            missing.append(f"dossiê ausente: {target}")

    augustine = assets / "agostinho"
    try:
        manifest = json.loads((augustine / "manifest.json").read_text(encoding="utf-8"))
        counts = manifest["chapterCounts"]
        if manifest.get("chapterCount") != 278 or not isinstance(counts, list) or len(counts) != 13:
            raise ValueError("contagem inválida")
        for n, count in enumerate(counts, 1):
            book = json.loads((augustine / f"{n}.json").read_text(encoding="utf-8"))
            if book.get("book") != n or len(book["chapters"]) != count:
                raise ValueError(f"livro {n} incompleto")
    except (OSError, ValueError, KeyError, TypeError):
        missing.append("Confissões de Agostinho: 13 livros/278 capítulos")

    return missing


def main() -> int:
    missing = missing_content()
    if not missing:
        print("Acervo editorial completo: 30 dossiês e 278 capítulos de Agostinho.")
        return 0
    print(f"Preparação necessária: {len(missing)} item(ns) ausente(s)/incompleto(s).")
    for item in missing[:5]:
        print(" -", item)
    if len(missing) > 5:
        print(f" - ... e mais {len(missing) - 5}")
    try:
        import fitz  # noqa: F401 -- obrigatório para ler o PDF fonte de Agostinho
    except ImportError:
        print(
            "Instale as dependências editoriais em um ambiente virtual na raiz do repositório:\n"
            "  python3 -m venv .venv\n"
            "  source .venv/bin/activate\n"
            "  python -m pip install -r scripts/requirements-content.txt\n"
            "Depois execute: cd pwa && npm run build",
            file=sys.stderr,
        )
        return 2

    print("Gerando acervo a partir das fontes originais locais; os textos existentes são preservados...")
    try:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "prepare_app_content.py")],
            cwd=ROOT,
            check=True,
        )
    except subprocess.CalledProcessError as error:
        print(f"Falha na preparação editorial (etapa Python, saída {error.returncode}).", file=sys.stderr)
        return error.returncode or 1

    incomplete = missing_content()
    if incomplete:
        print("A preparação terminou, mas o acervo ainda está incompleto:", file=sys.stderr)
        for item in incomplete:
            print(" -", item, file=sys.stderr)
        return 1
    print("Acervo editorial preparado e validado: 30 dossiês e 278 capítulos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
