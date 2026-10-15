#!/usr/bin/env bash
# Roda a suíte ponta a ponta contra o BACKEND REAL local: Postgres + API (backend/api.ts) + login simulado.
# O app é construído apontando para a API; cada arquivo de teste começa com o banco zerado.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"
export NODE_PATH="${NODE_PATH:-/opt/npm-tools/node_modules}"
PORT=54321
DB=$(backend/scripts/pg-local.sh)
echo "== fila de e-mails, criar organização, agendador (Postgres)"
DATABASE_URL="$DB" bun backend/jobs.test.ts
echo "== segunda barreira, limites de pedidos, bloqueio de senha (Postgres)"
DATABASE_URL="$DB" bun backend/seguranca.test.ts
INSPETA_API=http://localhost:$PORT/functions/v1/api INSPETA_AUTH=http://localhost:$PORT/auth/v1 INSPETA_ANON_KEY=anon-local OUT=app/dist-real ./scripts/build.sh
DEV=1 DATABASE_URL="$DB" APP_DIR=app/dist-real PORT=$PORT bun backend/dev.ts > /tmp/inspeta-dev.log 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
ARQS=${*:-"tests/api-seguranca.mjs tests/e2e-fatia.mjs tests/e2e-offline-pwa.mjs tests/e2e-marco2.mjs tests/e2e-marco3.mjs tests/e2e-agenda.mjs tests/e2e-painel.mjs tests/e2e-aprovacao.mjs tests/e2e-campo-extra.mjs tests/e2e-modelos.mjs tests/e2e-relatorio.mjs tests/e2e-campos.mjs"}
for f in $ARQS; do
  echo "== $f (backend real)"
  curl -s -X POST "http://localhost:$PORT/__dev/reset" >/dev/null
  BASE="http://localhost:$PORT/" BACKEND="http://localhost:$PORT" node "$f" | grep -v "web navegou"
done
echo "== tudo verde contra o backend real"
