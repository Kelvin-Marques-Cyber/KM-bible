#!/usr/bin/env bash
# Compila as telas Flutter ORIGINAIS para web; nao aproxima em HTML.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if ! command -v flutter >/dev/null 2>&1; then
  echo 'Flutter SDK nao encontrado' >&2
  exit 127
fi
# Nao publicar arquivos pessoais da ARA.
if [[ -d assets/private ]] && find assets/private -type f \( -iname '*.biblepkg' -o -iname '*.pdf' -o -iname '*.sqlite' \) -print -quit | grep -q .; then
  echo 'Arquivo privado em assets/private. Build interrompido.' >&2
  exit 4
fi
flutter --version
flutter config --enable-web
flutter create --platforms=web --project-name biblia_reformada .
python3 scripts/preparar_calvino_por_livro.py
flutter pub get
# Reduz a memoria e o trafego ao remover copias duplicadas de textos nos indices.
python3 scripts/otimizar_acervo_sqlite.py
# O sqlite3 2.9.4 exige o modulo WebAssembly do mesmo release na plataforma Web.
if [[ ! -s web/sqlite3.wasm ]]; then
  echo 'Baixando modulo oficial SQLite WebAssembly 2.9.4...'
  curl --fail --location --silent --show-error --retry 3 \
    'https://github.com/simolus3/sqlite3.dart/releases/download/sqlite3-2.9.4/sqlite3.wasm' \
    --output web/sqlite3.wasm.download
  mv web/sqlite3.wasm.download web/sqlite3.wasm
fi
python3 - <<'PY'
from pathlib import Path
file = Path('web/sqlite3.wasm')
if file.read_bytes()[:4] != b'\\x00asm'.decode('unicode_escape').encode('latin1'):
    raise SystemExit('ERRO: modulo sqlite3.wasm nao e valido')
print('SQLite WASM presente:', file.stat().st_size, 'bytes')
PY
python3 scripts/diagnosticar_web.py | tee flutter-web-dependencias.txt
# Falhar explicitamente se codigo nativo ainda nao foi adaptado.
if ! flutter build web --release --base-href /KM-bible/ 2>&1 | tee flutter-web-build.log; then
  echo 'Build falhou: veja flutter-web-build.log' >&2
  exit 1
fi
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path('build/web')
with ZipFile('build/biblia-reformada-flutter-web.zip','w',compression=ZIP_DEFLATED) as z:
    for path in sorted(root.rglob('*')):
        if path.is_file(): z.write(path,path.relative_to(root))
print('Build gerado: build/biblia-reformada-flutter-web.zip')
PY
