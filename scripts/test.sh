#!/usr/bin/env bash
# Roda tudo: testes do motor, build (com checagem de tipos e de contraste) e os testes ponta a ponta.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"
export NODE_PATH="${NODE_PATH:-/opt/npm-tools/node_modules}"

echo "== motor de formulário"
tsx --test packages/form-engine/test/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"

echo "== build"
./scripts/build.sh

echo "== ponta a ponta"
PORT=4173
(cd app/dist && python3 -m http.server $PORT >/dev/null 2>&1) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
BASE="http://localhost:$PORT/" node tests/e2e-fatia.mjs | grep -v "web navegou"
BASE="http://localhost:$PORT/" node tests/e2e-offline-pwa.mjs
echo "== tudo verde"
