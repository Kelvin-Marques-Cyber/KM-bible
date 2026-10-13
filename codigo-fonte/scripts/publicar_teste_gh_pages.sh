#!/usr/bin/env bash
# Publica o build FLUTTER original numa branch gh-pages isolada.
# Nao usa GitHub Actions nem modifica main.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" != "--sem-build" ]]; then
  bash scripts/build_flutter_web_fiel.sh
fi
for name in index.html flutter_bootstrap.js main.dart.js sqlite3.wasm assets/assets/content/catalogue.sqlite assets/assets/3d/viewer_immersive.html; do
  if [[ ! -s "build/web/$name" ]]; then
    echo "Falha de verificacao: build/web/$name ausente" >&2
    exit 2
  fi
done
if find build/web/assets/assets/private -type f \( -iname '*.biblepkg' -o -iname '*.sqlite' -o -iname '*.pdf' \) -print -quit 2>/dev/null | grep -q .; then
  echo 'FALHA: conteudo pessoal detectado na publicacao.' >&2
  exit 3
fi

# Substitui o service worker da antiga PWA estaticamente recriada.
cp scripts/sw_flutter_teste.js build/web/sw.js
# Cada publicacao recebe um cache versionado, evitando exibir a PWA antiga.
sed -i "s/biblia-flutter-web-053-20261013/biblia-flutter-web-$(date +%Y%m%d%H%M%S)/" build/web/sw.js
python3 - <<'PY'
from pathlib import Path
p=Path('build/web/index.html')
s=p.read_text()
snippet="""<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js', {scope:'./'})
      .catch(function(e){console.warn('Offline indisponivel:',e)});
  });
}
</script>"""
if "register('./sw.js'" not in s:
    if '</body>' not in s:
        raise SystemExit('Pagina HTML do Flutter inesperada')
    p.write_text(s.replace('</body>',snippet+'\n</body>'))
PY

git fetch origin gh-pages
tmp="$(mktemp -d)"
icon_backup="$(mktemp -d)"
cleanup(){
  git worktree remove --force "$tmp" >/dev/null 2>&1 || true
  rm -rf -- "$tmp" "$icon_backup"
}
trap cleanup EXIT
git worktree add --detach "$tmp" origin/gh-pages
# Mantem os icones personalizados usados no Android/PWA, nao os defaults Flutter.
for item in favicon.png icons; do
  if [[ -e "$tmp/$item" ]]; then cp -a "$tmp/$item" "$icon_backup/"; fi
done
# Preserva as paginas auxiliares e a biblioteca de modulos do site.
find "$tmp" -mindepth 1 -maxdepth 1 ! -name .git \
  ! -name diagnostico.html ! -name instalar.html ! -name modulos.html \
  ! -name agostinho.html ! -name codigo-fonte -exec rm -rf -- {} +
cp -a build/web/. "$tmp/"
cp -a "$icon_backup/." "$tmp/"
touch "$tmp/.nojekyll"
git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then
  echo 'O site ja esta atualizado.'
  exit 0
fi
git -C "$tmp" commit -m 'Teste: Flutter original com 3D, galaxia e portugues'
git -C "$tmp" push origin HEAD:gh-pages
echo 'Publicado na branch gh-pages.'
echo 'Abra: https://kelvin-marques-cyber.github.io/KM-bible/'
