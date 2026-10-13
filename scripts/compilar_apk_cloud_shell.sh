#!/usr/bin/env bash
# Compila APK ARM64 no Google Cloud Shell, com o mesmo acervo do Flutter Web.
# Reutiliza SDKs em /tmp para poupar espaco no HOME.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

if [[ "$(git branch --show-current)" != "flutter-web-fiel" ]]; then
  echo "ERRO: use git switch flutter-web-fiel antes do build." >&2
  exit 2
fi
for executable in git curl unzip python3; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    echo "Dependencia ausente: $executable" >&2
    exit 127
  fi
done

export FLUTTER_SUPPRESS_ANALYTICS=true
export PUB_CACHE="${PUB_CACHE:-/tmp/km-bible-pub-cache}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/tmp/km-bible-gradle-cache}"
export ANDROID_HOME="${ANDROID_HOME:-/tmp/km-bible-android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
mkdir -p "$PUB_CACHE" "$GRADLE_USER_HOME" "$ANDROID_HOME"

flutter_dir="/tmp/km-bible-flutter-3.47.7"
if [[ ! -x "$flutter_dir/bin/flutter" ]]; then
  if [[ -e "$flutter_dir" ]]; then
    echo "Flutter incompleto em $flutter_dir; apague pasta temporaria e tente de novo." >&2
    exit 2
  fi
  echo "==> Baixando Flutter SDK 3.47.7"
  git clone --depth 1 --branch 3.47.7 \
    https://github.com/flutter/flutter.git "$flutter_dir"
fi
export PATH="$flutter_dir/bin:$PATH"
flutter --version

if [[ -x /usr/lib/jvm/java-17-openjdk-amd64/bin/java ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  export PATH="$JAVA_HOME/bin:$PATH"
elif ! command -v java >/dev/null 2>&1; then
  echo "==> Instalando JDK 17"
  sudo apt-get update -qq
  sudo apt-get install -qq -y openjdk-17-jdk-headless
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  export PATH="$JAVA_HOME/bin:$PATH"
fi
java -version

sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [[ ! -x "$sdkmanager" ]]; then
  echo "==> Baixando Android SDK Command-Line Tools"
  temp="$(mktemp -d /tmp/km-bible-android-tools.XXXXXX)"
  trap 'rm -rf "$temp"' EXIT
  curl --fail --location --show-error --retry 3 \
    https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    --output "$temp/tools.zip"
  unzip -q "$temp/tools.zip" -d "$temp/unpacked"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  mv "$temp/unpacked/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$temp"
  trap - EXIT
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "==> Preparando Android SDK e NDK"
set +o pipefail
yes | "$sdkmanager" --sdk_root="$ANDROID_HOME" --licenses >/dev/null
set -o pipefail
"$sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "ndk;28.2.13676358"

flutter config --android-sdk "$ANDROID_HOME"
echo "==> Compilando APK completo ARM64"
BUILD_RAPIDO=1 bash scripts/build_android_otimizado.sh

apk="$(pwd)/build/app/outputs/flutter-apk/app-release.apk"
[[ -s "$apk" ]] || { echo "APK nao encontrado: $apk" >&2; exit 1; }
ls -lh "$apk"
echo "==> Pronto: $apk"
echo "==> Atualizacao por cima exige a mesma chave de assinatura."
