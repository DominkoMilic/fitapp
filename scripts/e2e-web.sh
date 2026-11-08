#!/usr/bin/env bash
# Builds the web bundle with a placeholder backend and runs the Playwright onboarding smoke test.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${E2E_OUT:-$ROOT/.e2e}"
rm -rf "$OUT/web" && mkdir -p "$OUT"
EXPO_OFFLINE=1 CI=1 \
  EXPO_PUBLIC_SUPABASE_URL=https://placeholder.invalid \
  EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_placeholder_key_123 \
  npx expo export --platform web --no-minify --output-dir "$OUT/web" >/dev/null
python3 -m http.server 8765 --directory "$OUT/web" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
node "$ROOT/tests/e2e/web/onboarding.e2e.js" "$OUT/screenshots"
