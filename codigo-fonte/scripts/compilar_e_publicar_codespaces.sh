#!/usr/bin/env bash
# Compila e publica o KM-bible no GitHub Codespaces (sem instalar nada no PC).
# O Flutter SDK fica apenas no ambiente remoto do Codespaces.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

if [[ "${CODESPACES:-}" != "true" && -z "${CODESPACE_NAME:-}" ]]; then
  echo "Aviso: use este script num GitHub Codespace para nao instalar ferramentas no PC."
fi

for required in git python3 curl; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Ferramenta basica ausente no ambiente remoto: $required" >&2
    exit 127
  fi
done

# O editor deve ter sido aberto a partir de flutter-web-fiel.
branch="$(git branch --show-current)"
if [[ "$branch" != "flutter-web-fiel" ]]; then
  echo "Branch atual: $branch. Mudando para flutter-web-fiel..."
  git fetch origin flutter-web-fiel
  git switch flutter-web-fiel 2>/dev/null || git switch --track -c flutter-web-fiel origin/flutter-web-fiel
fi

# Flutter da versao usada pelo projeto; apenas download na maquina da nuvem.
flutter_dir="${HOME}/.local/share/km-bible/flutter-3.47.7"
if [[ ! -x "$flutter_dir/bin/flutter" ]]; then
  mkdir -p "$(dirname "$flutter_dir")"
  git clone --depth 1 --branch 3.47.7 https://github.com/flutter/flutter.git "$flutter_dir"
fi
export PATH="$flutter_dir/bin:$PATH"
export CI=true
export FLUTTER_SUPPRESS_ANALYTICS=true
flutter --version
flutter config --enable-web

# GitHub Codespaces geralmente define a identidade; use fallback se nao existir.
if [[ -z "$(git config user.name || true)" ]]; then
  git config user.name "KM-bible Codespaces"
fi
if [[ -z "$(git config user.email || true)" ]]; then
  git config user.email "codespaces@users.noreply.github.com"
fi

# O script abaixo gera a traducao de Calvino em pt-BR caso falte, compila
# o Flutter Web e publica em gh-pages somente apos validar os artefatos.
bash scripts/publicar_teste_gh_pages.sh
