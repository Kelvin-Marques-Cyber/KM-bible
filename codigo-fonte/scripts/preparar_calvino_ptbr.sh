#!/usr/bin/env bash
# Converte os comentarios historicos de Calvino em recursos pt-BR no BUILD,
# nunca no dispositivo do leitor. Reusa o banco ja traduzido nas execucoes seguintes.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

if python3 scripts/verificar_traducoes_calvino.py; then
  echo 'Traducoes de Calvino ja estao prontas; pulando processamento.'
  exit 0
fi

if [[ "${CALVINO_PTBR_AUTO:-1}" != 1 ]]; then
  echo 'Traducoes incompletas. Execute: bash scripts/preparar_calvino_ptbr.sh' >&2
  exit 1
fi

if python3 -c 'import argostranslate' >/dev/null 2>&1; then
  PYTHON=python3
else
  echo 'Instalando Argos Translate apenas no ambiente de compilacao.'
  python3 -m venv .venv-traducao
  .venv-traducao/bin/python -m pip install --disable-pip-version-check argostranslate
  PYTHON=.venv-traducao/bin/python
fi

"$PYTHON" scripts/traduzir_comentarios_ptbr.py --calvino --retraduzir-danificados
python3 scripts/verificar_traducoes_calvino.py
