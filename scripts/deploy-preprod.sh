#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$CURRENT_BRANCH" ]]; then
    CURRENT_BRANCH="main"
fi

DEPLOY_TARGET="${DEPLOY_TARGET:-quickshare-test}"
DEPLOY_SSH_BIN="${DEPLOY_SSH_BIN:-quickshare-test-ssh}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/quickshare}"
DEPLOY_GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"
DEPLOY_GIT_BRANCH="${DEPLOY_GIT_BRANCH:-$CURRENT_BRANCH}"
DEPLOY_RUN_SMOKE="${DEPLOY_RUN_SMOKE:-0}"
DEPLOY_RUN_BROWSER_SMOKE="${DEPLOY_RUN_BROWSER_SMOKE:-0}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
DEPLOY_RTC_URL="${DEPLOY_RTC_URL:-http://127.0.0.1:8080/api/public/quickdrop/rtc-config}"
DEPLOY_HEALTH_RETRIES="${DEPLOY_HEALTH_RETRIES:-30}"
DEPLOY_HEALTH_SLEEP_SECONDS="${DEPLOY_HEALTH_SLEEP_SECONDS:-2}"

LOCAL_HEAD="$(git rev-parse HEAD)"
LOCAL_REMOTE_HEAD="$(git rev-parse --verify "${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH}" 2>/dev/null || true)"

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

require_cmd git
require_cmd "$DEPLOY_SSH_BIN"

if [[ -n "$LOCAL_REMOTE_HEAD" && "$LOCAL_HEAD" != "$LOCAL_REMOTE_HEAD" ]]; then
    log "local HEAD ${LOCAL_HEAD} differs from ${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH} ${LOCAL_REMOTE_HEAD}; remote deploy will use GitHub branch state"
fi

log "deploying branch ${DEPLOY_GIT_BRANCH} on ${DEPLOY_TARGET}"
"$DEPLOY_SSH_BIN" bash -s -- \
    "$DEPLOY_REMOTE_DIR" \
    "$DEPLOY_GIT_REMOTE" \
    "$DEPLOY_GIT_BRANCH" \
    "$DEPLOY_RUN_SMOKE" \
    "$DEPLOY_RUN_BROWSER_SMOKE" \
    "$DEPLOY_HEALTH_URL" \
    "$DEPLOY_RTC_URL" \
    "$DEPLOY_HEALTH_RETRIES" \
    "$DEPLOY_HEALTH_SLEEP_SECONDS" <<'REMOTE'
set -euo pipefail

REMOTE_DIR="$1"
GIT_REMOTE="$2"
GIT_BRANCH="$3"
RUN_SMOKE="$4"
RUN_BROWSER_SMOKE="$5"
HEALTH_URL="$6"
RTC_URL="$7"
HEALTH_RETRIES="$8"
HEALTH_SLEEP_SECONDS="$9"

log() {
    printf '[deploy] %s\n' "$*"
}

fail() {
    printf '[deploy] ERROR: %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "missing command on remote host: $1"
}

compose_cmd() {
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        docker compose "$@"
    fi
}

wait_for_health() {
    local attempt
    for attempt in $(seq 1 "$HEALTH_RETRIES"); do
        if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
            return 0
        fi
        sleep "$HEALTH_SLEEP_SECONDS"
    done
    return 1
}

checkout_ref() {
    local branch="$1"
    local ref="$2"

    if [[ "$branch" == "DETACHED" ]]; then
        git checkout --detach "$ref" >/dev/null 2>&1
    else
        git checkout -B "$branch" "$ref" >/dev/null 2>&1
    fi
}

cd "$REMOTE_DIR"

require_cmd git
require_cmd curl
require_cmd docker
test -d .git || fail "remote directory is not a git repository: $REMOTE_DIR"
test -f .env || fail "missing remote .env in $REMOTE_DIR"

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
PREVIOUS_BRANCH="$(git symbolic-ref --short -q HEAD || echo DETACHED)"
CURRENT_REMOTE_URL="$(git remote get-url "$GIT_REMOTE" 2>/dev/null || true)"
TARGET_REF="${GIT_REMOTE}/${GIT_BRANCH}"

[[ -n "$CURRENT_REMOTE_URL" ]] || fail "git remote '${GIT_REMOTE}' is not configured in $REMOTE_DIR"

log "remote repo: ${CURRENT_REMOTE_URL}"
log "fetching ${TARGET_REF}"
git fetch --prune "$GIT_REMOTE"
git rev-parse --verify "$TARGET_REF" >/dev/null 2>&1 || fail "target ref not found after fetch: ${TARGET_REF}"

TARGET_COMMIT="$(git rev-parse "$TARGET_REF")"
ROLLBACK_NEEDED=0

rollback() {
    log "rolling back to ${PREVIOUS_BRANCH}:${PREVIOUS_COMMIT}"
    checkout_ref "$PREVIOUS_BRANCH" "$PREVIOUS_COMMIT"
    git reset --hard "$PREVIOUS_COMMIT" >/dev/null
    git clean -fdx -e .env >/dev/null
    printf '%s\n' "$PREVIOUS_COMMIT" > DEPLOYED_COMMIT
    compose_cmd up --build -d --remove-orphans || true
}

log "checking out ${TARGET_REF} (${TARGET_COMMIT})"
checkout_ref "$GIT_BRANCH" "$TARGET_REF"
git reset --hard "$TARGET_REF" >/dev/null
git clean -fdx -e .env >/dev/null
printf '%s\n' "$TARGET_COMMIT" > DEPLOYED_COMMIT

if ! compose_cmd up --build -d --remove-orphans; then
    ROLLBACK_NEEDED=1
fi

if [[ "$ROLLBACK_NEEDED" == "0" ]] && ! wait_for_health; then
    ROLLBACK_NEEDED=1
fi

if [[ "$ROLLBACK_NEEDED" == "1" ]]; then
    rollback
    fail "deploy failed before post-deploy validation; previous commit restored"
fi

HEALTH_BODY="$(curl -fsS "$HEALTH_URL")"
RTC_STATUS="passed"
RTC_BODY=""
if ! RTC_BODY="$(curl -fsS "$RTC_URL")"; then
    RTC_STATUS="failed"
fi

SMOKE_STATUS="skipped"
if [[ "$RUN_SMOKE" == "1" ]]; then
    if ./scripts/quickshare-smoke.sh; then
        SMOKE_STATUS="passed"
    else
        SMOKE_STATUS="failed"
    fi
fi

BROWSER_SMOKE_STATUS="skipped"
if [[ "$RUN_BROWSER_SMOKE" == "1" ]]; then
    if ./scripts/quickshare-playwright-smoke.sh; then
        BROWSER_SMOKE_STATUS="passed"
    else
        BROWSER_SMOKE_STATUS="failed"
    fi
fi

FINAL_STATUS=0
[[ "$RTC_STATUS" == "failed" ]] && FINAL_STATUS=1
[[ "$SMOKE_STATUS" == "failed" ]] && FINAL_STATUS=1
[[ "$BROWSER_SMOKE_STATUS" == "failed" ]] && FINAL_STATUS=1

log "summary: branch=${GIT_BRANCH} previous_commit=${PREVIOUS_COMMIT} deployed_commit=${TARGET_COMMIT} health=passed rtc=${RTC_STATUS} smoke=${SMOKE_STATUS} browser_smoke=${BROWSER_SMOKE_STATUS}"
log "health body: ${HEALTH_BODY}"
if [[ "$RTC_STATUS" == "passed" ]]; then
    log "rtc-config body: ${RTC_BODY}"
else
    log "rtc-config request failed"
fi

if [[ "$FINAL_STATUS" != "0" ]]; then
    log "post-deploy validation failed; current commit remains deployed for investigation"
fi

exit "$FINAL_STATUS"
REMOTE

log "deployment complete"
