#!/usr/bin/env bash
# Publicação completa e segura da PWA: só publica se TUDO passar.
#   bash pwa/scripts/release.sh            # verifica, compila, testa, publica e confere o site
#   KM_DRY_RUN=1 bash pwa/scripts/release.sh   # tudo, menos o envio
# Etapas: tsc → vitest → build (dados já gerados) → Playwright → gh-pages → site no ar.
set -Eeuo pipefail
PWA="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PWA"
SITE="${KM_SITE:-https://kelvin-marques-cyber.github.io/KM-bible/}"

echo "==> 1/6 Tipos";        npx tsc --noEmit
echo "==> 2/6 Unitários";    npx vitest run
if [[ ! -s public/data/v1/catalog.json ]]; then
  echo "==> Gerando dados";  python3 scripts/build_data.py
fi
echo "==> 3/6 Build";        npx vite build >/dev/null && node scripts/finalize_build.mjs
echo "==> 4/6 Ponta a ponta"; npx playwright test
echo "==> 5/6 Publicação";   KM_REMOVE_CODIGO_FONTE="${KM_REMOVE_CODIGO_FONTE:-1}" bash scripts/publish_gh_pages.sh
[[ "${KM_DRY_RUN:-0}" == "1" ]] && exit 0

BUILD="$(python3 -c "import json;print(json.load(open('dist/app-version.json'))['build'])")"
echo "==> 6/6 Conferindo o site (build $BUILD)"
for _ in $(seq 1 45); do
  live="$(curl -fsS "${SITE}app-version.json?t=$(date +%s)" | python3 -c "import json,sys;print(json.load(sys.stdin)['build'])" 2>/dev/null || true)"
  if [[ "$live" == "$BUILD" ]]; then echo "No ar: $SITE (build $BUILD)"; exit 0; fi
  sleep 20
done
echo "O GitHub Pages ainda não serve o build $BUILD (verifique mais tarde)." >&2
exit 3
