#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'A compilação iOS requer macOS com Xcode e CocoaPods.' >&2
  exit 1
fi
export CI=true
export FLUTTER_SUPPRESS_ANALYTICS=true
flutter --suppress-analytics config --no-enable-swift-package-manager
flutter --suppress-analytics pub get
python3 scripts/prepare_optional_content.py
(cd ios && pod install)
if [[ -n "${BIBLIA_EXPORT_OPTIONS:-}" ]]; then
  flutter --suppress-analytics build ipa --release --export-options-plist "$BIBLIA_EXPORT_OPTIONS"
else
  flutter --suppress-analytics build ios --release --no-codesign
  python3 scripts/package_ios.py
  echo 'IPA real sem assinatura e ZIP gerados em dist/. Instale e reassine pelo SideStore com sua conta Apple.'
fi
