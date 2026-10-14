#!/usr/bin/env bash
# Empacota as funções do Supabase num arquivo JS cada (o Deno do Supabase não precisa resolver nossos imports).
# postgres e pdf-lib ficam de fora como "npm:..."; o Supabase baixa na implantação.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"
export NODE_PATH="${NODE_PATH:-/opt/npm-tools/node_modules}"
for f in api jobs; do
  mkdir -p supabase/functions/$f
  out=supabase/functions/$f/index.js
  bun build backend/funcao-$f.ts --outfile $out --target browser --format esm --minify-syntax --minify-identifiers \
    --external "npm:postgres@3.4.5" --external pdf-lib --define process.env.NODE_ENV='"production"' >/dev/null
  sed -i 's#from "pdf-lib"#from "npm:pdf-lib@1.17.1"#' $out
  if grep -q "process\.env" $out; then echo "process.env sobrou no bundle de $f" >&2; exit 1; fi
  echo "$out: $(du -h $out | cut -f1)"
done
