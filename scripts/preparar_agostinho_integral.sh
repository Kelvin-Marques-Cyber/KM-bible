#!/usr/bin/env bash
# Gera, no computador de build, a edicao integral de Confissoes em pt-BR.
# Textos nunca sao resumidos. Falha se faltar algum dos 278 capitulos.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if [[ -s assets/agostinho/manifest.json ]]; then
  if python3 - <<'PY'
import json
from pathlib import Path
p=Path("assets/agostinho")
try:
    m=json.loads((p/"manifest.json").read_text())
    assert m["status"]=="integral" and m["chapterCount"]==278
    assert len(m["chapterCounts"])==13
    for index,count in enumerate(m["chapterCounts"],1):
        b=json.loads((p/f"{index}.json").read_text())
        assert len(b["chapters"])==count
        # Layout v2 foi gerado parcialmente pelo normalizador com defeito.
        # Não o reutilizar: recuperar todas as páginas a partir do PDF original.
        assert all(ch.get("layout_version") != 2 for ch in b["chapters"])
        assert all(len(str(ch["body"]))>=220 for ch in b["chapters"])
except (AssertionError, OSError, ValueError, KeyError):
    raise SystemExit(1)
PY
  then
    echo "Agostinho: os 278 capitulos integrais ja estao preparados."
    exit 0
  fi
fi
VENV="${AUGUSTINE_VENV:-/tmp/km-bible-augustine-venv}"
if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
fi
if ! "$VENV/bin/python" -c 'import fitz, gdown' >/dev/null 2>&1; then
  "$VENV/bin/python" -m pip install -q --disable-pip-version-check 'pymupdf>=1.24,<2' 'gdown>=5,<7'
fi
# O PDF integral ja foi incorporado ao repositorio. Evita baixar 3,39 MB
# novamente no Cloud Shell a cada build; o documento continua inalterado.
ARGS=(--download)
if [[ -s assets/agostinho/confissoes-santo-agostinho-ptbr.pdf ]]; then
  ARGS=(--pdf assets/agostinho/confissoes-santo-agostinho-ptbr.pdf)
fi
if [[ -n "${AGOSTINHO_PDF:-}" ]]; then
  ARGS=(--pdf "$AGOSTINHO_PDF")
fi
"$VENV/bin/python" scripts/preparar_agostinho_integral.py "${ARGS[@]}"
