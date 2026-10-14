#!/usr/bin/env bash
# Roda tudo: testes do motor, build (com checagem de tipos e de contraste) e os testes ponta a ponta.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"
export NODE_PATH="${NODE_PATH:-/opt/npm-tools/node_modules}"

echo "== testes de unidade (motor de formulário e agenda)"
tsx --test packages/form-engine/test/*.test.ts app/test/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"

echo "== build"
./scripts/build.sh

echo "== ponta a ponta"
PORT=4174
python3 -m http.server $PORT -d app/dist >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1
BASE="http://localhost:$PORT/" node tests/e2e-fatia.mjs | grep -v "web navegou"
BASE="http://localhost:$PORT/" node tests/e2e-offline-pwa.mjs
BASE="http://localhost:$PORT/" node tests/e2e-marco2.mjs
BASE="http://localhost:$PORT/" node tests/e2e-marco3.mjs
BASE="http://localhost:$PORT/" node tests/e2e-agenda.mjs
BASE="http://localhost:$PORT/" node tests/e2e-painel.mjs
BASE="http://localhost:$PORT/" node tests/e2e-aprovacao.mjs
BASE="http://localhost:$PORT/" node tests/e2e-campo-extra.mjs
BASE="http://localhost:$PORT/" node tests/e2e-modelos.mjs
BASE="http://localhost:$PORT/" node tests/e2e-relatorio.mjs
BASE="http://localhost:$PORT/" node tests/e2e-campos.mjs
echo "== tudo verde"
