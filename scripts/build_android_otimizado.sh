#!/usr/bin/env bash
# APK Android ARM64 com o MESMO acervo do Flutter Web.
# Execute depois de configurar Flutter, JDK e Android SDK no Cloud Shell.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

for tool in flutter python3; do
  command -v "$tool" >/dev/null || { echo "Falta $tool no PATH" >&2; exit 127; }
done

# Resguarda conteudo pessoal nao autorizado para o build publico.
if [[ -d assets/private ]] && find assets/private -type f \( -iname '*.biblepkg' -o -iname '*.sqlite' -o -iname '*.pdf' \) -print -quit | grep -q .; then
  echo 'Existem arquivos pessoais em assets/private; nao serao empacotados no APK.' >&2
  exit 4
fi

# O conteudo dos bancos e comum ao Web e ao Android.
# Na primeira instalacao, modulos bundled ja estarão nos SQLite estaticos.
if [[ "${BUILD_RAPIDO:-1}" != "1" ]]; then
  bash scripts/preparar_calvino_ptbr.sh
else
  echo 'Build Android rapido: preservando traducoes existentes de Calvino.'
fi
python3 scripts/preparar_calvino_por_livro.py
bash scripts/preparar_agostinho_integral.sh
python3 scripts/normalizar_agostinho.py
python3 scripts/verificar_agostinho_layout.py
python3 scripts/gerar_panorama_apologetica.py
python3 scripts/ampliar_apologetica.py
python3 scripts/verificar_apologetica.py

flutter pub get
python3 scripts/embutir_modulos_bundled.py
python3 scripts/otimizar_acervo_sqlite.py
python3 scripts/verificar_modulos_embutidos.py

# Os fragmentos sao exclusivos do Flutter Web; no Android usamos SQLite
# integral e removemos shards temporarios para nao dobrar o tamanho do APK.
rm -f assets/content/*.sqlite.part*.bin assets/content/sqlite-web-parts.json

# Permite ajustar para builds posteriores mantendo incremento do versionCode.
flutter build apk --release --target-platform android-arm64 \
  --build-name="${APK_VERSION_NAME:-0.5.4}" \
  --build-number="${APK_VERSION_CODE:-54}"

artifact="build/app/outputs/flutter-apk/app-release.apk"
[[ -s "$artifact" ]] || { echo 'APK nao foi criado' >&2; exit 1; }
echo "APK pronto: $(pwd)/$artifact"
echo 'Importante: atualizar um APK existente requer a mesma chave de assinatura.'
