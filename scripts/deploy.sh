#!/usr/bin/env bash
# Build, run a minimal smoke set against the built files, then publish dist/ to the gh-pages branch (GitHub Pages).
# v3.9.1: refuses to publish if the build or any smoke fails. Each smoke has a 120 s timeout. (Never runs the full verify.)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
# v3.9.2: always a dedicated preview of THIS dist on a free port; the smokes test exactly that address.
PORT=$(node -e "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})")
npx vite preview --port "$PORT" --strictPort >/tmp/ek-deploy-preview.log 2>&1 & PREV_PID=$!
cleanup() { kill "$PREV_PID" 2>/dev/null || true; }
trap cleanup EXIT
URL="http://localhost:$PORT/"
for i in $(seq 1 30); do curl -sf -o /dev/null "$URL" && break; sleep 1; done
WANT=$(node -p "require('./public/version.json').v")
GOT=$(curl -sf "${URL}version.json" | node -p "JSON.parse(require('fs').readFileSync(0)).v") || { echo "preview not serving - not deploying"; exit 1; }
[ "$GOT" = "$WANT" ] || { echo "preview serves $GOT, expected $WANT - not deploying"; exit 1; }
echo "testing fresh dist at $URL ($GOT)"
for s in smoke-freshstart smoke38 smoke39 smoke40; do
  echo "deploy smoke: $s"; timeout 120 node "scripts/$s.mjs" "$URL" > "/tmp/ek-deploy-$s.log" 2>&1 || { echo "SMOKE FAILED: $s (see /tmp/ek-deploy-$s.log) - not deploying"; exit 1; }
done
cd dist && touch .nojekyll && rm -rf .git && git init -q -b gh-pages && git add -A && git commit -qm "Deploy $(date -u +%FT%TZ)"
git push -f "https://github.com/Missyrupert/edinburgh-kickabout.git" gh-pages
rm -rf .git
