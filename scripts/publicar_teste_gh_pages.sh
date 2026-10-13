#!/usr/bin/env bash
# Publica o build FLUTTER original numa branch gh-pages isolada.
# Nao usa GitHub Actions nem modifica main.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" != "--sem-build" ]]; then
  bash scripts/build_flutter_web_fiel.sh
fi
for name in index.html flutter_bootstrap.js main.dart.js sqlite3.wasm assets/assets/content/sqlite-web-parts.json assets/assets/3d/viewer_immersive.html; do
  if [[ ! -s "build/web/$name" ]]; then
    echo "Falha de verificacao: build/web/$name ausente" >&2
    exit 2
  fi
done
# Verifica SHA das partes e que nenhum arquivo excede o limite do GitHub.
python3 scripts/particionar_sqlite_web.py --validar-build
# Protege contra publicação de assets incompletos ou da ARA apenas
# como nome no catálogo, em vez de texto realmente pronto para leitura.
python3 - <<'PY'
import json,sqlite3
from pathlib import Path
root=Path('build/web/assets/assets')
for folder,count in [('apologetica',30),
                     ('apologetica_extra',30),
                     ('apologetica_reformada',30)]:
    files=list((root/folder).glob('*.md'))
    if len(files)!=count:
        raise SystemExit(f'Publicacao interrompida: {folder} tem {len(files)}/{count} textos.')
for i in range(1,14):
    if not (root/'agostinho'/f'{i}.json').exists():
        raise SystemExit(f'Publicacao interrompida: Agostinho livro {i} ausente.')
manifest=json.loads((root/'agostinho'/'manifest.json').read_text())
if manifest['chapterCount']!=278:
    raise SystemExit('Publicacao interrompida: indice de Agostinho incompleto.')
# Os arquivos >50 MB são publicados em partes; a conferência de registros
# usa a fonte SQLite, já submetida ao teste de integridade do build.
db=sqlite3.connect(Path('assets/content/catalogue.sqlite'))
try:
    row=db.execute("SELECT count(*),count(distinct book),count(distinct book||':'||chapter) FROM verses WHERE translation='ARA'").fetchone()
    if tuple(row)!=(31104,66,1189):
        raise SystemExit(f'Publicacao interrompida: ARA invalida {row}.')
    count=db.execute("SELECT count(*) FROM content_modules WHERE builtin=1 AND installed=1").fetchone()[0]
    if count<17:
        raise SystemExit(f'Publicacao interrompida: apenas {count} modulos ativos.')
finally:
    db.close()
print('Publicacao validada: ARA, modulos, Agostinho e 60 suplementos.')
PY
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
  ! -name agostinho.html ! -name atualizar.html ! -name codigo-fonte -exec rm -rf -- {} +
cp -a build/web/. "$tmp/"
cp -a "$icon_backup/." "$tmp/"
# Garante que também as páginas auxiliares preservadas não tragam blobs >100 MB.
python3 - "$tmp" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1])
large=[f"{p.relative_to(root)} ({p.stat().st_size})"
       for p in root.rglob('*') if p.is_file() and p.stat().st_size >= 100_000_000]
if large: raise SystemExit("Bloqueado por limite de 100 MB do GitHub: " + ", ".join(large))
print("GH001: todos os arquivos de publicacao abaixo de 100 MB.")
PY
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
