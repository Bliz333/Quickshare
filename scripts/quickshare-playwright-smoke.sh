#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLAYWRIGHT_DOCKER_IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"
PLAYWRIGHT_TEST_TARGET="${PLAYWRIGHT_TEST_TARGET:-tests/e2e/quickdrop-real.spec.js}"
PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
PLAYWRIGHT_REPORTER="${PLAYWRIGHT_REPORTER:-line}"
PLAYWRIGHT_NPM_CACHE_DIR="${PLAYWRIGHT_NPM_CACHE_DIR:-/tmp/quickshare-playwright-npm-cache}"
E2E_ADMIN_USERNAME="${E2E_ADMIN_USERNAME:-admin}"
E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-ChangeMeAdmin123!}"

log() {
    printf '[playwright-smoke] %s\n' "$*"
}

fail() {
    printf '[playwright-smoke] ERROR: %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

require_cmd docker

mkdir -p "$PLAYWRIGHT_NPM_CACHE_DIR"

if ! docker image inspect "$PLAYWRIGHT_DOCKER_IMAGE" >/dev/null 2>&1; then
    log "pulling ${PLAYWRIGHT_DOCKER_IMAGE}"
    docker pull "$PLAYWRIGHT_DOCKER_IMAGE"
fi

log "running ${PLAYWRIGHT_TEST_TARGET} against ${PLAYWRIGHT_BASE_URL}"
docker run --rm \
    --network host \
    --ipc=host \
    -e CI=1 \
    -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    -e PLAYWRIGHT_BASE_URL \
    -e PLAYWRIGHT_TEST_TARGET \
    -e PLAYWRIGHT_REPORTER \
    -e E2E_ADMIN_USERNAME \
    -e E2E_ADMIN_PASSWORD \
    -v "$ROOT_DIR:/workspace" \
    -v "$PLAYWRIGHT_NPM_CACHE_DIR:/root/.npm" \
    -w /workspace \
    "$PLAYWRIGHT_DOCKER_IMAGE" \
    bash -lc 'npm ci --no-audit --no-fund && npx playwright test "$PLAYWRIGHT_TEST_TARGET" --reporter="$PLAYWRIGHT_REPORTER"'
