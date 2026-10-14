#!/usr/bin/env bash
# Sobe um Postgres 16 local (porta 5434, sem senha) para desenvolver e testar a API sem o Supabase.
# Idempotente: se já estiver rodando, não faz nada. Uso: backend/scripts/pg-local.sh [parar]
set -euo pipefail
BIN=/usr/lib/postgresql/16/bin
DIR=/var/tmp/pginspeta
PORT=5434
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
if [ "${1:-}" = parar ]; then run "$BIN/pg_ctl -D $DIR/data stop -m fast" || true; exit 0; fi
if [ ! -d "$DIR/data" ]; then
  mkdir -p "$DIR"; [ "$(id -u)" = 0 ] && chown postgres "$DIR"
  run "$BIN/initdb -D $DIR/data -A trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null"
fi
if ! run "$BIN/pg_ctl -D $DIR/data status" >/dev/null 2>&1; then
  run "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k /tmp' -l $DIR/log start -w" >/dev/null
fi
echo "postgres://postgres@127.0.0.1:$PORT/postgres"
