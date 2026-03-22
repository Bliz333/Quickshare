#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_TARGET="${DEPLOY_TARGET:-quickshare-test}"
DEPLOY_SSH_BIN="${DEPLOY_SSH_BIN:-quickshare-test-ssh}"
DEPLOY_SCP_BIN="${DEPLOY_SCP_BIN:-quickshare-test-scp}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/quickshare}"
DEPLOY_REMOTE_BACKUP_DIR="${DEPLOY_REMOTE_BACKUP_DIR:-/root/quickshare-backups}"
DEPLOY_SKIP_PACKAGE="${DEPLOY_SKIP_PACKAGE:-0}"
DEPLOY_RUN_SMOKE="${DEPLOY_RUN_SMOKE:-0}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
DEPLOY_RTC_URL="${DEPLOY_RTC_URL:-http://127.0.0.1:8080/api/public/quickdrop/rtc-config}"
DEPLOY_VERIFY_RETRIES="${DEPLOY_VERIFY_RETRIES:-30}"
DEPLOY_VERIFY_SLEEP_SECONDS="${DEPLOY_VERIFY_SLEEP_SECONDS:-2}"
DEPLOY_VERIFY_TIMEOUT_SECONDS="${DEPLOY_VERIFY_TIMEOUT_SECONDS:-20}"

STAMP="$(date +%Y%m%d-%H%M%S)"
GIT_COMMIT="$(git rev-parse HEAD)"
ARCHIVE_BASENAME="quickshare-deploy-${STAMP}.tgz"
REMOTE_ARCHIVE="/root/${ARCHIVE_BASENAME}"
REMOTE_STAGE_DIR="/root/quickshare.release-${STAMP}"
REMOTE_PREV_DIR="/root/quickshare.previous-${STAMP}"
LOCAL_ARCHIVE="$(mktemp "/tmp/${ARCHIVE_BASENAME}.XXXXXX")"

log() {
    printf '[deploy] %s\n' "$*"
}

fail() {
    printf '[deploy] ERROR: %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

cleanup() {
    rm -f "$LOCAL_ARCHIVE"
}

trap cleanup EXIT

require_cmd git
require_cmd tar
require_cmd timeout
require_cmd "$DEPLOY_SSH_BIN"
require_cmd "$DEPLOY_SCP_BIN"

if [[ "$DEPLOY_SKIP_PACKAGE" != "1" ]]; then
    log "building application jar"
    ./mvnw -q -DskipTests package
fi

compgen -G "target/*.jar" >/dev/null || fail "target/*.jar not found; run package first"

log "packaging current workspace at commit ${GIT_COMMIT}"
tar \
    --exclude=.git \
    --exclude=.env \
    --exclude=node_modules \
    --exclude=playwright-report \
    --exclude=test-results \
    --exclude='.idea' \
    --exclude='.vscode' \
    --exclude='.claude' \
    --exclude='target/surefire-reports' \
    --exclude='target/test-classes' \
    --exclude='target/generated-test-sources' \
    -czf "$LOCAL_ARCHIVE" .

log "uploading ${ARCHIVE_BASENAME} to ${DEPLOY_TARGET}"
"$DEPLOY_SCP_BIN" "$LOCAL_ARCHIVE" "${DEPLOY_TARGET}:${REMOTE_ARCHIVE}"

log "deploying archive on ${DEPLOY_TARGET}"
"$DEPLOY_SSH_BIN" bash -s -- \
    "$DEPLOY_REMOTE_DIR" \
    "$DEPLOY_REMOTE_BACKUP_DIR" \
    "$REMOTE_ARCHIVE" \
    "$REMOTE_STAGE_DIR" \
    "$REMOTE_PREV_DIR" \
    "$GIT_COMMIT" \
    "$DEPLOY_RUN_SMOKE" \
    "$DEPLOY_HEALTH_URL" <<'REMOTE'
set -euo pipefail

REMOTE_DIR="$1"
BACKUP_DIR="$2"
ARCHIVE_PATH="$3"
STAGE_DIR="$4"
PREV_DIR="$5"
GIT_COMMIT="$6"
RUN_SMOKE="$7"
HEALTH_URL="$8"

compose_cmd() {
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        docker compose "$@"
    fi
}

test -f "$ARCHIVE_PATH"
test -d "$REMOTE_DIR"
test -f "$REMOTE_DIR/.env"

mkdir -p "$BACKUP_DIR"
rm -rf "$STAGE_DIR"
tar -czf "${BACKUP_DIR}/quickshare-${GIT_COMMIT}.tgz" -C /root quickshare
mkdir -p "$STAGE_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$STAGE_DIR"
cp "$REMOTE_DIR/.env" "$STAGE_DIR/.env"
printf '%s\n' "$GIT_COMMIT" > "${STAGE_DIR}/DEPLOYED_COMMIT"

(
    cd "$REMOTE_DIR"
    compose_cmd down --remove-orphans
)

rm -rf "$PREV_DIR"
mv "$REMOTE_DIR" "$PREV_DIR"
mv "$STAGE_DIR" "$REMOTE_DIR"

rollback() {
    rm -rf "$REMOTE_DIR"
    mv "$PREV_DIR" "$REMOTE_DIR"
    (
        cd "$REMOTE_DIR"
        compose_cmd up -d
    ) || true
}

if ! (
    cd "$REMOTE_DIR"
    compose_cmd up --build -d
); then
    rollback
    exit 1
fi

wait_for_health() {
    local attempt
    for attempt in $(seq 1 30); do
        if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    return 1
}

if [[ "$RUN_SMOKE" == "1" ]]; then
    wait_for_health
    (
        cd "$REMOTE_DIR"
        ./scripts/quickshare-smoke.sh
    )
fi

rm -f "$ARCHIVE_PATH"
REMOTE

verify_remote() {
    local url="$1"
    local pattern="${2:-}"
    local attempt body

    for attempt in $(seq 1 "$DEPLOY_VERIFY_RETRIES"); do
        if body="$(timeout "$DEPLOY_VERIFY_TIMEOUT_SECONDS" "$DEPLOY_SSH_BIN" "curl -fsS ${url}" 2>/dev/null)"; then
            if [[ -z "$pattern" || "$body" == *"$pattern"* ]]; then
                printf '%s\n' "$body"
                return 0
            fi
        fi
        sleep "$DEPLOY_VERIFY_SLEEP_SECONDS"
    done

    return 1
}

log "verifying /api/health"
health_body="$(verify_remote "$DEPLOY_HEALTH_URL" '"status":"UP"')" || fail "health verification failed"
log "health ok: ${health_body}"

log "verifying /api/public/quickdrop/rtc-config"
rtc_body="$(verify_remote "$DEPLOY_RTC_URL" '"directTransferEnabled"')" || fail "rtc-config verification failed"
log "rtc-config ok: ${rtc_body}"

log "deployment complete"
