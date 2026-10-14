#!/usr/bin/env bash
# Cria tools/anki/.venv e instala requirements.txt (anki==25.2) se ainda não estiver pronto. Idempotente.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$AQUI/.venv"
PYTHON_VENV="$VENV/bin/python"

if [ -x "$PYTHON_VENV" ] && "$PYTHON_VENV" -c "import anki" >/dev/null 2>&1; then
  echo "$VENV pronto ($("$PYTHON_VENV" -c 'import anki.buildinfo as b; print("anki", b.version)'))"
  exit 0
fi

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
"$PYTHON_VENV" -m pip install --quiet --disable-pip-version-check -r "$AQUI/requirements.txt"
echo "$VENV pronto ($("$PYTHON_VENV" -c 'import anki.buildinfo as b; print("anki", b.version)'))"
