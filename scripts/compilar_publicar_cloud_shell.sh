#!/usr/bin/env bash
# Google Cloud Shell: Flutter Web + gh-pages, tudo na nuvem (sem Actions).
set -Eeuo pipefail
cd "$(dirname "$0")/.."

echo "==> KM-bible: preparando ambiente remoto"
echo "==> Branch: $(git branch --show-current)"
if [[ "$(git branch --show-current)" != "flutter-web-fiel" ]]; then
  echo "ERRO: abra a branch flutter-web-fiel antes de compilar." >&2
  exit 2
fi
for tool in git curl python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta $tool neste terminal remoto." >&2
    exit 127
  fi
done

# Coloca Flutter e dependencias na area temporaria, liberando os 5 GB de HOME.
# /tmp e apagado ao encerrar a instancia do Cloud Shell.
export PUB_CACHE="${PUB_CACHE:-/tmp/km-bible-pub-cache}"
flutter_dir="/tmp/km-bible-flutter-3.47.7"
if [[ ! -x "$flutter_dir/bin/flutter" ]]; then
  if [[ -e "$flutter_dir" ]]; then
    echo "SDK incompleto em $flutter_dir; apague essa pasta temporaria e tente novamente." >&2
    exit 2
  fi
  echo "==> Baixando Flutter 3.47.7 na maquina remota"
  git clone --depth 1 --branch 3.47.7 https://github.com/flutter/flutter.git "$flutter_dir"
fi
export PATH="$flutter_dir/bin:$PATH"
export FLUTTER_SUPPRESS_ANALYTICS=true
flutter --version

# A publicacao na branch gh-pages requer autorizacao GitHub para escrever.
if ! command -v gh >/dev/null 2>&1; then
  echo "==> Preparando GitHub CLI somente no Cloud Shell"
  sudo apt-get update -qq
  sudo apt-get install -y -qq gh
fi
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "==> Autorize o GitHub quando o terminal solicitar."
  gh auth login -h github.com -p https --web
fi
gh auth setup-git -h github.com
git config user.name "$(gh api user --jq .login)"
git config user.email "km-bible-cloud-shell@users.noreply.github.com"

if [[ "${1:-}" != "--somente-publicar" ]]; then
  echo "==> Gerando Flutter Web (modo rapido, sem traduzir 11 mil comentarios)"
  BUILD_RAPIDO=1 bash scripts/build_flutter_web_fiel.sh
else
  echo "==> Reaproveitando build/web ja compilado."
fi

echo "==> Publicando em gh-pages sem Actions"
bash scripts/publicar_teste_gh_pages.sh --sem-build
echo "==> Pronto: https://kelvin-marques-cyber.github.io/KM-bible/"
