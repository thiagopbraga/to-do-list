#!/usr/bin/env bash
# Cria tools/anki/.venv e instala a biblioteca anki. Idempotente: o pip só altera o venv se a versão pedida difere da instalada.
# ANKI_VERSAO: vazio = versão fixada em requirements.txt; "latest" = a mais recente do PyPI; outro valor = essa versão exata.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$AQUI/.venv"
PYTHON_VENV="$VENV/bin/python"
VERSAO="${ANKI_VERSAO:-}"

if [ ! -x "$PYTHON_VENV" ]; then
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON=python3.11
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON=python3
  else
    echo "python3.11 (ou python3) não encontrado no PATH" >&2
    exit 1
  fi
  echo "criando $VENV com $("$PYTHON" --version)"
  "$PYTHON" -m venv "$VENV"
fi

PIP=("$PYTHON_VENV" -m pip install --quiet --disable-pip-version-check)
case "$VERSAO" in
  "") "${PIP[@]}" -r "$AQUI/requirements.txt" ;;
  latest) "${PIP[@]}" --upgrade anki ;;
  *) "${PIP[@]}" "anki==$VERSAO" ;;
esac

echo "$VENV pronto (anki $("$PYTHON_VENV" -c 'import anki.buildinfo as b; print(b.version)'))"
