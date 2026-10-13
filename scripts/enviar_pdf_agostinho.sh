#!/usr/bin/env bash
# Envia APENAS o PDF integral de Santo Agostinho para a branch Flutter.
# Não reescreve SQLite, não toca nas anotações e não publica versão não testada.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if [[ "$(git branch --show-current)" != "flutter-web-fiel" ]]; then
  echo 'Abra flutter-web-fiel antes de enviar o PDF.' >&2
  exit 2
fi
src=".cache/agostinho/confissoes-solus-agape.pdf"
dst="assets/agostinho/confissoes-santo-agostinho-ptbr.pdf"
if [[ ! -s "$src" ]]; then
  echo "PDF não encontrado: $src" >&2
  exit 3
fi
if [[ "$(head -c 4 "$src")" != '%PDF' ]]; then
  echo 'Arquivo baixado não é um PDF válido.' >&2
  exit 4
fi
mkdir -p "$(dirname "$dst")"
cp "$src" "$dst"
git add -- "$dst"
if git diff --cached --quiet -- "$dst"; then
  echo 'PDF de Agostinho já estava versionado nesta branch.'
else
  if [[ -z "$(git config user.name || true)" ]]; then
    git config user.name "KM-bible Cloud Shell"
  fi
  if [[ -z "$(git config user.email || true)" ]]; then
    git config user.email "km-bible-cloud-shell@users.noreply.github.com"
  fi
  git commit -m "Adiciona PDF integral autorizado de Confissoes em pt-BR" -- "$dst"
fi
git push origin HEAD:flutter-web-fiel
echo 'PDF integral enviado à branch flutter-web-fiel.'
echo 'A extração para capítulos JSON continua pendente até sua validação.'
echo "Fonte: $dst"
