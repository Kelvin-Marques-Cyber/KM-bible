#!/usr/bin/env bash
# PWA: preparar acervo completo -> dados -> tipos -> unitarios -> build -> E2E
# -> validar arvore gh-pages -> publicar -> verificar site.
# KM_DRY_RUN=1 bash pwa/scripts/release.sh verifica sem enviar alteracoes.
set -Eeuo pipefail
PWA="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$PWA/.." && pwd)"
cd "$PWA"
SITE="${KM_SITE:-https://kelvin-marques-cyber.github.io/KM-bible/}"

# Os JSONs finais de Agostinho e da apologetica expandida sao gerados e ignorados
# no Git: uma copia nova, ou um build antigo, pode ter catalogo parcial mesmo
# contendo public/data/v1/catalog.json. Nao confie na existencia do catalogo.
echo "==> 1/9 Verificando as fontes do acervo"
needs_content="$(python3 - "$REPO" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
aug = root / "assets/agostinho"
apol = root / "assets/apologetica_reformada"
try:
    m = json.loads((aug / "manifest.json").read_text(encoding="utf-8"))
    if m.get("chapterCount") != 278 or len(m.get("chapterCounts", [])) != 13:
        raise ValueError("Manifesto de Agostinho incompleto")
    for n, expected in enumerate(m["chapterCounts"], 1):
        data = json.loads((aug / f"{n}.json").read_text(encoding="utf-8"))
        if data.get("book") != n or len(data.get("chapters", [])) != expected:
            raise ValueError(f"Livro {n} de Agostinho incompleto")
    profiles = json.loads((root / "assets/content/apologetica-editorial.json").read_text(encoding="utf-8"))["profiles"]
    if len(profiles) != 30:
        raise ValueError("Perfil editorial incompleto")
    for target, profile in profiles.items():
        dossier = (apol / f"{target}.md")
        body = dossier.read_text(encoding="utf-8")
        if len(body) < 7000 or not all(axis in body for axis in profile["axes"]):
            raise ValueError(f"Dossie {target} antigo ou incompleto")
    print("no")
except (OSError, ValueError, KeyError, TypeError):
    print("yes")
PY
)"
if [[ "$needs_content" == "yes" ]]; then
  echo "==> Preparando Agostinho (278 capitulos) e dossies de apologetica"
  if ! python3 -c 'import fitz' >/dev/null 2>&1; then
    echo "Falta PyMuPDF para extrair o PDF local de Agostinho." >&2
    echo "Em um ambiente virtual Python, instale: pip install -r scripts/requirements-content.txt" >&2
    echo "Depois repita bash pwa/scripts/release.sh. Nada foi publicado." >&2
    exit 2
  fi
  (cd "$REPO" && python3 scripts/prepare_app_content.py)
fi

echo "==> 2/9 Gerando dados completos e fontes"
# SEMPRE regenerar para sincronizar o catalogo incorporado no JS com os arquivos
# de public/data/v1. Catalogo antigo podia ter agostinho=null, embora o PDF
# estivesse no repositorio, provocando 5 falhas falsas na suite.
python3 scripts/build_data.py
python3 scripts/build_fonts.py
python3 - <<'PY'
import json
from pathlib import Path
cat = json.loads(Path("public/data/v1/catalog.json").read_text(encoding="utf-8"))
for key in ("agostinho", "apologetica"):
    pack = cat.get(key)
    if not pack:
        raise SystemExit(f"Acervo incompleto: {key} ausente do catalogo; publicacao bloqueada.")
    root = Path("public/data/v1") / pack["path"]
    if key == "agostinho":
        if not (root / "manifest.json").is_file() or not all((root / f"{n}.json").is_file() for n in range(1, 14)):
            raise SystemExit("Acervo de Agostinho incompleto na saida da PWA.")
    if key == "apologetica":
        if not (root / "presbyterian.json").is_file():
            raise SystemExit("Dossie de apologetica ausente na saida da PWA.")
print("Acervo validado: Agostinho e apologetica disponiveis.")
PY

echo "==> 3/9 Tipos";         npx tsc --noEmit
echo "==> 4/9 Unitarios";     npx vitest run

# As salas multiplayers são um serviço independente com package-lock próprio.
# Os E2E de dois navegadores iniciam esse servidor localmente: sem instalar
# a dependência 'ws' deste diretório o teste falha antes de abrir a PWA.
echo "==> 5/9 Testes do servidor de salas"
if ! node -e 'const [major,minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 18)) process.exit(1)' ; then
  echo "O servidor Mezuzá Clássico precisa de Node 22.18 ou superior para ler TypeScript nativamente." >&2
  echo "Versão encontrada: $(node --version). Atualize o Node antes de publicar." >&2
  exit 2
fi
if [[ ! -f "$REPO/mezuzah-server/node_modules/ws/package.json" ]]; then
  echo "==> Instalando ws de forma isolada, usando o lockfile do servidor"
  npm ci --prefix "$REPO/mezuzah-server" --ignore-scripts --no-audit --no-fund
fi
(cd "$REPO/mezuzah-server" && npm test)

echo "==> 6/9 Build";         npx vite build >/dev/null && node scripts/finalize_build.mjs
echo "==> 7/9 Ponta a ponta"; npx playwright test
echo "==> 8/9 Validar publicacao e enviar"
KM_REMOVE_CODIGO_FONTE="${KM_REMOVE_CODIGO_FONTE:-1}" bash scripts/publish_gh_pages.sh
if [[ "${KM_DRY_RUN:-0}" == "1" ]]; then
  echo "KM_DRY_RUN=1: todos os testes e a arvore passaram; nada publicado."
  exit 0
fi

BUILD="$(python3 -c "import json;print(json.load(open('dist/app-version.json'))['build'])")"
echo "==> 9/9 Conferindo o site (build $BUILD)"
for _ in $(seq 1 45); do
  live="$(curl -fsS "${SITE}app-version.json?t=$(date +%s)" | python3 -c "import json,sys;print(json.load(sys.stdin)['build'])" 2>/dev/null || true)"
  if [[ "$live" == "$BUILD" ]]; then echo "No ar: $SITE (build $BUILD)"; exit 0; fi
  sleep 20
done
echo "O GitHub Pages ainda nao serve o build $BUILD (confira a publicacao)." >&2
exit 3
