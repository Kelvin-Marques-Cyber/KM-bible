#!/usr/bin/env bash
# Publica a PWA em gh-pages SEM baixar a branch inteira (1+ GB): monta a nova árvore
# git a partir da árvore atual (versão clássica Flutter preservada) + arquivos de dist/.
#
#   bash pwa/scripts/publish_gh_pages.sh            # usa dist/ já compilado
#   KM_BUILD=1 bash pwa/scripts/publish_gh_pages.sh # compila antes (npm run build)
#   KM_DRY_RUN=1 ...                                # monta e valida, sem enviar
#
# Regras:
# - index.html da versão clássica (Flutter) vira classico.html; os demais arquivos
#   dela (assets/, canvaskit/, main.dart.js…) continuam no mesmo lugar.
# - codigo-fonte/ (cópia antiga do repositório, não referenciada) é removida: o site
#   passava de 1 GB, limite do GitHub Pages. O código continua no repositório.
# - Arquivos app/* dos dois builds anteriores são mantidos, para que abas abertas
#   com a versão antiga não quebrem durante a atualização.
set -Eeuo pipefail
PWA="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$PWA/.." && pwd)"
DIST="$PWA/dist"
cd "$REPO"

if [[ "${KM_BUILD:-0}" == "1" ]]; then
  (cd "$PWA" && npm run build)
fi
for required in index.html sw.js flutter_service_worker.js app-version.json manifest.webmanifest data/v1/catalog.json data/v1/files.json; do
  [[ -s "$DIST/$required" ]] || { echo "dist incompleto: falta $required (rode npm run build)" >&2; exit 2; }
done
grep -q 'flutter_bootstrap' "$DIST/index.html" && { echo "dist/index.html não é a PWA" >&2; exit 2; }

echo "==> Atualizando referência gh-pages"
git fetch --filter=blob:none --depth=1 origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages >/dev/null
BASE="$(git rev-parse origin/gh-pages)"
BUILD="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['build'])" "$DIST/app-version.json")"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GIT_INDEX_FILE="$TMP/index"
git read-tree "$BASE"

listing() { git ls-files --stage; }

# 1) Página inicial clássica → classico.html (mesmo conteúdo, só muda o nome).
if git cat-file -p "$(git ls-files -s index.html | awk '{print $2}')" 2>/dev/null | grep -q flutter_bootstrap; then
  sha="$(git ls-files -s index.html | awk '{print $2}')"
  git update-index --add --cacheinfo "100644,$sha,classico.html"
  echo "    index.html (Flutter) → classico.html"
fi

# 2) Remove a cópia do código-fonte e os arquivos da PWA anterior (exceto app/ recentes).
KEEP_APP="$TMP/keep-app.txt"
: > "$KEEP_APP"
if git ls-files --error-unmatch app-builds.json >/dev/null 2>&1; then
  git cat-file -p "$(git ls-files -s app-builds.json | awk '{print $2}')" > "$TMP/app-builds.json" || true
  python3 - "$TMP/app-builds.json" "$KEEP_APP" <<'PY'
import json, sys
try:
    builds = json.load(open(sys.argv[1]))
except Exception:
    builds = []
keep = set()
for entry in builds[-2:]:
    keep.update(entry.get("files", []))
open(sys.argv[2], "w").write("\n".join(sorted(keep)))
PY
fi
python3 - "$KEEP_APP" > "$TMP/remove.txt" <<'PY'
import subprocess, sys
keep = set(open(sys.argv[1]).read().split())
files = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True).stdout.splitlines()
pwa_root = {"index.html", "sw.js", "flutter_service_worker.js", "app-version.json", "manifest.webmanifest", "app-builds.json"}
for path in files:
    if path.startswith("codigo-fonte/") or path.startswith("data/") or path.startswith("fonts/") \
            or path in pwa_root or path.startswith("icons/icon-") or path.startswith("icons/maskable-") \
            or path.startswith("icons/favicon-") or path == "icons/apple-touch-icon.png" \
            or (path.startswith("app/") and path not in keep):
        print(path)
PY
if [[ -s "$TMP/remove.txt" ]]; then
  git update-index --force-remove --stdin < "$TMP/remove.txt"
fi
echo "    removidos da árvore: $(wc -l < "$TMP/remove.txt") arquivos"

# 3) Acrescenta dist/ (blobs gravados localmente; os da versão clássica já estão no GitHub).
(cd "$DIST" && find . -type f ! -name '*.map' | sed 's|^\./||' | sort) > "$TMP/add.txt"
(cd "$DIST" && git hash-object -w --stdin-paths < "$TMP/add.txt") > "$TMP/shas.txt"
paste -d '\t' <(sed 's/^/100644 /' "$TMP/shas.txt") "$TMP/add.txt" | git update-index --add --index-info
grep '^app/' "$TMP/add.txt" > "$TMP/app-files.txt" || true
python3 - "$TMP/app-builds.json" "$TMP/app-files.txt" "$BUILD" > "$TMP/app-builds.new.json" <<'PY'
import json, sys
try:
    builds = json.load(open(sys.argv[1]))
except Exception:
    builds = []
builds = [b for b in builds if b.get("build") != sys.argv[3]][-2:]
builds.append({"build": sys.argv[3], "files": open(sys.argv[2]).read().split()})
print(json.dumps(builds))
PY
sha="$(git hash-object -w "$TMP/app-builds.new.json")"
git update-index --add --cacheinfo "100644,$sha,app-builds.json"
if ! git ls-files --error-unmatch .nojekyll >/dev/null 2>&1; then
  sha="$(git hash-object -w /dev/null)"
  git update-index --add --cacheinfo "100644,$sha,.nojekyll"
fi

# 4) Validações: tamanho do site, maior arquivo, páginas essenciais.
TREE="$(git write-tree)"
python3 - "$TREE" <<'PY'
import subprocess, sys
tree = sys.argv[1]
out = subprocess.run(["git", "ls-tree", "-r", "-l", tree], capture_output=True, text=True, check=True).stdout.splitlines()
total = 0
largest = (0, "")
names = set()
for line in out:
    meta, path = line.split("\t", 1)
    size = int(meta.split()[3])
    total += size
    names.add(path)
    largest = max(largest, (size, path))
print(f"    site: {len(out)} arquivos, {total / 1e6:.1f} MB; maior: {largest[1]} ({largest[0] / 1e6:.1f} MB)")
for required in ("index.html", "sw.js", "app-version.json", "manifest.webmanifest", "classico.html", "data/v1/catalog.json"):
    if required not in names:
        sys.exit(f"Falta {required} na árvore publicada")
if largest[0] > 100 * 1024 * 1024:
    sys.exit("Arquivo maior que 100 MB: o GitHub recusaria o envio")
if total > 1000 * 1000 * 1000:
    sys.exit("O site passaria de 1 GB (limite do GitHub Pages)")
PY

COMMIT="$(git commit-tree "$TREE" -p "$BASE" -m "PWA Bíblia Reformada $BUILD

Nova PWA (React/TypeScript) na raiz; versão Flutter clássica em classico.html.
Atualização forçada via service worker; dados fragmentados em data/v1.")"
echo "==> Commit $COMMIT sobre $BASE"
if [[ "${KM_DRY_RUN:-0}" == "1" ]]; then
  echo "KM_DRY_RUN=1: nada enviado."
  exit 0
fi
for attempt in 1 2 3 4 5; do
  if git push origin "$COMMIT:refs/heads/gh-pages"; then
    echo "==> Publicado. Verifique: https://kelvin-marques-cyber.github.io/KM-bible/app-version.json (build $BUILD)"
    exit 0
  fi
  sleep $((2 ** attempt))
done
echo "Falha ao enviar para gh-pages" >&2
exit 1
