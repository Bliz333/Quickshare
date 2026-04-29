#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLAYWRIGHT_DOCKER_IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"
PLAYWRIGHT_TEST_TARGET="${PLAYWRIGHT_TEST_TARGET:-tests/e2e/quickdrop-real.spec.js}"
PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
PLAYWRIGHT_REPORTER="${PLAYWRIGHT_REPORTER:-line}"
PLAYWRIGHT_NPM_CACHE_DIR="${PLAYWRIGHT_NPM_CACHE_DIR:-/tmp/quickshare-playwright-npm-cache}"
PLAYWRIGHT_LOCAL_FALLBACK="${PLAYWRIGHT_LOCAL_FALLBACK:-1}"
PLAYWRIGHT_LOCAL_INSTALL_DEPS="${PLAYWRIGHT_LOCAL_INSTALL_DEPS:-1}"
E2E_ADMIN_USERNAME="${E2E_ADMIN_USERNAME:-admin}"
E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-ChangeMeAdmin123!}"
EXPECT_QUICKDROP_FINAL_MODE="${EXPECT_QUICKDROP_FINAL_MODE:-}"

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

mkdir -p "$PLAYWRIGHT_NPM_CACHE_DIR"

run_local_playwright() {
    require_cmd npm
    require_cmd npx
    log "running ${PLAYWRIGHT_TEST_TARGET} locally against ${PLAYWRIGHT_BASE_URL}"
    CI=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BASE_URL="$PLAYWRIGHT_BASE_URL" \
    E2E_ADMIN_USERNAME="$E2E_ADMIN_USERNAME" \
    E2E_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" \
    EXPECT_QUICKDROP_FINAL_MODE="$EXPECT_QUICKDROP_FINAL_MODE" \
    npm ci --no-audit --no-fund
    if [[ "$PLAYWRIGHT_LOCAL_INSTALL_DEPS" == "1" ]] && command -v apt-get >/dev/null 2>&1; then
        CI=1 npx playwright install-deps chromium
    fi
    CI=1 npx playwright install chromium
    CI=1 \
    PLAYWRIGHT_BASE_URL="$PLAYWRIGHT_BASE_URL" \
    E2E_ADMIN_USERNAME="$E2E_ADMIN_USERNAME" \
    E2E_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" \
    EXPECT_QUICKDROP_FINAL_MODE="$EXPECT_QUICKDROP_FINAL_MODE" \
    npx playwright test "$PLAYWRIGHT_TEST_TARGET" --reporter="$PLAYWRIGHT_REPORTER"
}

if ! command -v docker >/dev/null 2>&1; then
    if [[ "$PLAYWRIGHT_LOCAL_FALLBACK" == "1" ]]; then
        log "Docker is unavailable; falling back to local Node/Chromium"
        run_local_playwright
        exit 0
    fi
    fail "missing command: docker"
fi

if ! docker image inspect "$PLAYWRIGHT_DOCKER_IMAGE" >/dev/null 2>&1; then
    log "pulling ${PLAYWRIGHT_DOCKER_IMAGE}"
    if ! docker pull "$PLAYWRIGHT_DOCKER_IMAGE"; then
        if [[ "$PLAYWRIGHT_LOCAL_FALLBACK" == "1" ]]; then
            log "Docker Playwright image unavailable; falling back to local Node/Chromium"
            run_local_playwright
            exit 0
        fi
        fail "failed to pull ${PLAYWRIGHT_DOCKER_IMAGE}"
    fi
fi

log "running ${PLAYWRIGHT_TEST_TARGET} against ${PLAYWRIGHT_BASE_URL}"
if ! docker run --rm \
    --network host \
    --ipc=host \
    -e "CI=1" \
    -e "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" \
    -e "PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL}" \
    -e "PLAYWRIGHT_TEST_TARGET=${PLAYWRIGHT_TEST_TARGET}" \
    -e "PLAYWRIGHT_REPORTER=${PLAYWRIGHT_REPORTER}" \
    -e "E2E_ADMIN_USERNAME=${E2E_ADMIN_USERNAME}" \
    -e "E2E_ADMIN_PASSWORD=${E2E_ADMIN_PASSWORD}" \
    -e "EXPECT_QUICKDROP_FINAL_MODE=${EXPECT_QUICKDROP_FINAL_MODE}" \
    -v "$ROOT_DIR:/workspace" \
    -v "$PLAYWRIGHT_NPM_CACHE_DIR:/root/.npm" \
    -w /workspace \
    "$PLAYWRIGHT_DOCKER_IMAGE" \
    bash -lc 'npm ci --no-audit --no-fund && npx playwright test "$PLAYWRIGHT_TEST_TARGET" --reporter="$PLAYWRIGHT_REPORTER"'; then
    if [[ "$PLAYWRIGHT_LOCAL_FALLBACK" == "1" ]]; then
        log "Docker Playwright run failed; falling back to local Node/Chromium"
        run_local_playwright
        exit 0
    fi
    exit 1
fi
