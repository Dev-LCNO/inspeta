#!/usr/bin/env bash
# Build do app (Bun como bundler, sem rede). Saída em app/dist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; cd "$ROOT"

tsc -p .                                   # checagem de tipos estrita
python3 replica/design/build_tokens.py >/dev/null
python3 replica/design/contrast.py replica/design/tokens.json >/dev/null   # falha se algum par cair abaixo de AA

V=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
[ -n "$(git status --porcelain 2>/dev/null)" ] && V="$V-$(date +%s)"
# OUT muda a pasta; INSPETA_API/INSPETA_AUTH/INSPETA_ANON_KEY ligam o backend real (vazio = modo demonstração)
OUT="${OUT:-app/dist}"
rm -rf "$OUT" && mkdir -p "$OUT"
LOG=$(mktemp)
bun build app/src/main.tsx --outdir "$ROOT/$OUT" --entry-naming main.js --minify --target browser --sourcemap=linked \
  --define process.env.NODE_ENV='"production"' \
  --define "process.env.INSPETA_API=\"${INSPETA_API:-}\"" \
  --define "process.env.INSPETA_AUTH=\"${INSPETA_AUTH:-}\"" \
  --define "process.env.INSPETA_ANON_KEY=\"${INSPETA_ANON_KEY:-}\"" >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
[ -s "$OUT/main.js" ] || { echo "bundle não gerado"; cat "$LOG"; exit 1; }
cat replica/design/tokens.css app/src/styles.css > "$OUT/app.css"
for f in index.html sw.js; do sed "s/__V__/$V/g" "app/public/$f" > "$OUT/$f"; done
cp app/public/manifest.webmanifest app/public/icon.svg "$OUT/"
echo "build ok ($V${INSPETA_API:+, backend $INSPETA_API}): $(du -sh "$OUT" | cut -f1)"
