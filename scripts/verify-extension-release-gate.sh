#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Tribora extension release gate =="
echo "Running focused extension and extension API contract tests..."

npm test -- --runInBand --runTestsByPath \
  packages/extension/__tests__/action-confirmation.test.ts \
  packages/extension/__tests__/action-safety-policy.test.ts \
  packages/extension/__tests__/action-verification.test.ts \
  packages/extension/__tests__/auth-callback.test.ts \
  packages/extension/__tests__/context-engine-dom-first.test.ts \
  packages/extension/__tests__/context-knowledge-provenance.test.ts \
  packages/extension/__tests__/frame-targeting.test.ts \
  packages/extension/__tests__/page-context-payload.test.ts \
  packages/extension/__tests__/session-startup.test.ts \
  packages/extension/__tests__/telemetry.test.ts \
  packages/extension/__tests__/voice-agent-policy.test.ts \
  packages/extension/__tests__/voice-tool-routing.test.ts \
  packages/extension/__tests__/widget.test.ts \
  src/app/api/extension/context/__tests__/route.test.ts \
  src/app/api/extension/debug-events/__tests__/route.test.ts \
  src/app/api/extension/deepgram-token/__tests__/route.test.ts \
  src/app/api/extension/live-context/__tests__/route.test.ts \
  src/app/api/extension/query/__tests__/route.test.ts

echo "Building browser extension package..."
npm run build:extension

echo "Extension release gate passed."
