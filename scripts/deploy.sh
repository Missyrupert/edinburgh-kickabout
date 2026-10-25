#!/usr/bin/env bash
# Build, run a minimal smoke set against the built files, then publish dist/ to the gh-pages branch (GitHub Pages).
# v3.9.1: refuses to publish if the build or any smoke fails. Each smoke has a 120 s timeout. (Never runs the full verify.)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
PREV_PID=""
if ! curl -s -o /dev/null http://localhost:4199/; then npx vite preview --port 4199 --strictPort >/tmp/ek-deploy-preview.log 2>&1 & PREV_PID=$!; sleep 3; fi
cleanup() { [ -n "$PREV_PID" ] && kill "$PREV_PID" 2>/dev/null || true; }
trap cleanup EXIT
for s in smoke-freshstart smoke38 smoke21; do
  echo "deploy smoke: $s"; timeout 120 node "scripts/$s.mjs" > "/tmp/ek-deploy-$s.log" 2>&1 || { echo "SMOKE FAILED: $s (see /tmp/ek-deploy-$s.log) - not deploying"; exit 1; }
done
cd dist && touch .nojekyll && rm -rf .git && git init -q -b gh-pages && git add -A && git commit -qm "Deploy $(date -u +%FT%TZ)"
git push -f "https://github.com/Missyrupert/edinburgh-kickabout.git" gh-pages
rm -rf .git
