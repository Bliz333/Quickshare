#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLAYWRIGHT_DOCKER_IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"
PLAYWRIGHT_TEST_TARGET="${PLAYWRIGHT_TEST_TARGET:-tests/e2e/quickdrop-real.spec.js}"
PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
PLAYWRIGHT_REPORTER="${PLAYWRIGHT_REPORTER:-line}"
PLAYWRIGHT_PROJECT="${PLAYWRIGHT_PROJECT:-}"
PLAYWRIGHT_NPM_CACHE_DIR="${PLAYWRIGHT_NPM_CACHE_DIR:-/tmp/quickshare-playwright-npm-cache}"
E2E_ADMIN_USERNAME="${E2E_ADMIN_USERNAME:-admin}"
E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-ChangeMeAdmin123!}"
EXPECT_QUICKDROP_FINAL_MODE="${EXPECT_QUICKDROP_FINAL_MODE:-}"
PLAYWRIGHT_SMOKE_UP="${PLAYWRIGHT_SMOKE_UP:-${SMOKE_UP:-0}}"
PLAYWRIGHT_HEALTH_ATTEMPTS="${PLAYWRIGHT_HEALTH_ATTEMPTS:-30}"
PLAYWRIGHT_HEALTH_SLEEP_SECONDS="${PLAYWRIGHT_HEALTH_SLEEP_SECONDS:-2}"

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

compose_cmd() {
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        docker compose "$@"
    fi
}

wait_for_health_ready() {
    local body=""

    for ((i = 1; i <= PLAYWRIGHT_HEALTH_ATTEMPTS; i++)); do
        body="$(curl -sS --max-time 10 "${PLAYWRIGHT_BASE_URL}/api/health" 2>/dev/null || true)"
        if [[ "$body" == *'"status":"UP"'* && "$body" == *'"database":"UP"'* && "$body" == *'"redis":"UP"'* ]]; then
            return 0
        fi
        sleep "$PLAYWRIGHT_HEALTH_SLEEP_SECONDS"
    done

    fail "health endpoint did not become ready at ${PLAYWRIGHT_BASE_URL}"
}

require_cmd docker

if [[ "$PLAYWRIGHT_SMOKE_UP" == "1" ]]; then
    log "docker compose up --build -d"
    compose_cmd up --build -d
    log "wait for /api/health readiness"
    wait_for_health_ready
fi

mkdir -p "$PLAYWRIGHT_NPM_CACHE_DIR"

if ! docker image inspect "$PLAYWRIGHT_DOCKER_IMAGE" >/dev/null 2>&1; then
    log "pulling ${PLAYWRIGHT_DOCKER_IMAGE}"
    docker pull "$PLAYWRIGHT_DOCKER_IMAGE"
fi

log "running ${PLAYWRIGHT_TEST_TARGET} against ${PLAYWRIGHT_BASE_URL}"
docker run --rm \
    --network host \
    --ipc=host \
    -e "CI=1" \
    -e "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" \
    -e "PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL}" \
    -e "PLAYWRIGHT_TEST_TARGET=${PLAYWRIGHT_TEST_TARGET}" \
    -e "PLAYWRIGHT_REPORTER=${PLAYWRIGHT_REPORTER}" \
    -e "PLAYWRIGHT_PROJECT=${PLAYWRIGHT_PROJECT}" \
    -e "E2E_ADMIN_USERNAME=${E2E_ADMIN_USERNAME}" \
    -e "E2E_ADMIN_PASSWORD=${E2E_ADMIN_PASSWORD}" \
    -e "EXPECT_QUICKDROP_FINAL_MODE=${EXPECT_QUICKDROP_FINAL_MODE}" \
    -v "$ROOT_DIR:/workspace" \
    -v "$PLAYWRIGHT_NPM_CACHE_DIR:/root/.npm" \
    -w /workspace \
    "$PLAYWRIGHT_DOCKER_IMAGE" \
    bash -lc 'npm ci --no-audit --no-fund && PROJECT_ARG="" && if [ -n "$PLAYWRIGHT_PROJECT" ]; then PROJECT_ARG="--project=$PLAYWRIGHT_PROJECT"; fi && npx playwright test "$PLAYWRIGHT_TEST_TARGET" --reporter="$PLAYWRIGHT_REPORTER" $PROJECT_ARG'
