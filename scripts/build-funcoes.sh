#!/usr/bin/env bash
# Empacota as funções do Supabase num arquivo JS cada (o Deno do Supabase não precisa resolver nossos imports).
# Só "npm:postgres" fica de fora: o Supabase baixa na implantação.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"
export NODE_PATH="${NODE_PATH:-/opt/npm-tools/node_modules}"
for f in api jobs; do
  mkdir -p supabase/functions/$f
  bun build backend/funcao-$f.ts --outfile supabase/functions/$f/index.js --target browser --format esm --minify-syntax \
    --external "npm:postgres@3.4.5" --define process.env.NODE_ENV='"production"' >/dev/null
  if grep -q "process\.env" supabase/functions/$f/index.js; then echo "process.env sobrou no bundle de $f" >&2; exit 1; fi
  echo "supabase/functions/$f/index.js: $(du -h supabase/functions/$f/index.js | cut -f1)"
done
