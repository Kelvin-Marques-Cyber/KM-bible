#!/usr/bin/env bash
# APK otimizado da Biblia Reformada, Android ARM64.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if ! command -v flutter >/dev/null 2>&1; then
 echo 'Flutter SDK ausente no PATH' >&2
 exit 127
fi
if [[ -d assets/private ]] && find assets/private -type f \( -iname '*.biblepkg' -o -iname '*.sqlite' -o -iname '*.pdf' \) -print -quit | grep -q .; then
 echo 'Conteudo privado em assets/private; o build publico foi bloqueado.' >&2
 exit 4
fi
flutter pub get
python3 scripts/otimizar_acervo_sqlite.py
flutter build apk --release --target-platform android-arm64 --build-name=0.5.4 --build-number=54
echo
echo "APK: $(pwd)/build/app/outputs/flutter-apk/app-release.apk"
echo 'NOTA: Instalar por cima do APK anterior exige a mesma chave de assinatura.'
