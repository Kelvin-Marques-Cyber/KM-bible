#!/usr/bin/env python3
"""Prepara e verifica o acervo local usado por Flutter e PWA, sem downloads.

Os textos editoriais revisados e as traduções existentes são preservados.
Execute após instalar scripts/requirements-content.txt.
"""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(script: str, *args: str) -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / script), *args],
                   cwd=ROOT, check=True)


def main() -> None:
    run("prepare_optional_content.py")
    run("gerar_panorama_apologetica.py", "--preserve-existing")
    run("ampliar_apologetica.py")
    run("gerar_dossies_especificos.py")
    run("verificar_apologetica.py")
    run("verificar_traducoes_calvino.py")
    run("preparar_calvino_por_livro.py")
    run("preparar_agostinho_integral.py", "--pdf",
        "assets/agostinho/confissoes-santo-agostinho-ptbr.pdf")
    run("normalizar_agostinho.py")
    run("verificar_agostinho_layout.py")


if __name__ == "__main__":
    main()
