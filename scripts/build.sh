#!/usr/bin/env bash
# Build do app (Bun como bundler, sem rede). Saída em app/dist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"

tsc -p .                                   # checagem de tipos estrita
python3 replica/design/build_tokens.py >/dev/null
python3 replica/design/contrast.py replica/design/tokens.json >/dev/null   # falha se algum par cair abaixo de AA

V=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
[ -n "$(git status --porcelain 2>/dev/null)" ] && V="$V-$(date +%s)"
rm -rf app/dist && mkdir -p app/dist
LOG=$(mktemp)
bun build app/src/main.tsx --outdir "$ROOT/app/dist" --entry-naming main.js --minify --target browser --sourcemap=linked >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
[ -s app/dist/main.js ] || { echo "bundle não gerado"; cat "$LOG"; exit 1; }
cat replica/design/tokens.css app/src/styles.css > app/dist/app.css
for f in index.html sw.js; do sed "s/__V__/$V/g" "app/public/$f" > "app/dist/$f"; done
cp app/public/manifest.webmanifest app/public/icon.svg app/dist/
echo "build ok ($V): $(du -sh app/dist | cut -f1)"
