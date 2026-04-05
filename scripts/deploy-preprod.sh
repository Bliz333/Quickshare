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
DEPLOY_SCP_BIN="${DEPLOY_SCP_BIN:-quickshare-test-scp}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/quickshare}"
DEPLOY_GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"
DEPLOY_GIT_BRANCH="${DEPLOY_GIT_BRANCH:-$CURRENT_BRANCH}"
DEPLOY_RUN_SMOKE="${DEPLOY_RUN_SMOKE:-0}"
DEPLOY_RUN_BROWSER_SMOKE="${DEPLOY_RUN_BROWSER_SMOKE:-0}"
DEPLOY_ENABLE_SNAPSHOT_FALLBACK="${DEPLOY_ENABLE_SNAPSHOT_FALLBACK:-1}"
DEPLOY_SSH_TIMEOUT_SECONDS="${DEPLOY_SSH_TIMEOUT_SECONDS:-900}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
DEPLOY_RTC_URL="${DEPLOY_RTC_URL:-http://127.0.0.1:8080/api/public/transfer/rtc-config}"
DEPLOY_HEALTH_RETRIES="${DEPLOY_HEALTH_RETRIES:-30}"
DEPLOY_HEALTH_SLEEP_SECONDS="${DEPLOY_HEALTH_SLEEP_SECONDS:-2}"

LOCAL_HEAD="$(git rev-parse HEAD)"
LOCAL_REMOTE_HEAD="$(git rev-parse --verify "${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH}" 2>/dev/null || true)"
SNAPSHOT_ARCHIVE_LOCAL="/tmp/quickshare-deploy-src-${LOCAL_HEAD}.tar.gz"
SNAPSHOT_ARCHIVE_REMOTE="/root/quickshare-deploy-src-${LOCAL_HEAD}.tar.gz"

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
require_cmd timeout

if [[ "$DEPLOY_ENABLE_SNAPSHOT_FALLBACK" == "1" ]]; then
    require_cmd "$DEPLOY_SCP_BIN"
    log "preparing source snapshot fallback archive ${SNAPSHOT_ARCHIVE_LOCAL}"
    rm -f "$SNAPSHOT_ARCHIVE_LOCAL"
    git archive --format=tar "$LOCAL_HEAD" | gzip > "$SNAPSHOT_ARCHIVE_LOCAL"
    log "uploading source snapshot to ${DEPLOY_TARGET}:${SNAPSHOT_ARCHIVE_REMOTE}"
    "$DEPLOY_SCP_BIN" "$SNAPSHOT_ARCHIVE_LOCAL" "${DEPLOY_TARGET}:${SNAPSHOT_ARCHIVE_REMOTE}"
fi

if [[ -n "$LOCAL_REMOTE_HEAD" && "$LOCAL_HEAD" != "$LOCAL_REMOTE_HEAD" ]]; then
    log "local HEAD ${LOCAL_HEAD} differs from ${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH} ${LOCAL_REMOTE_HEAD}; remote deploy will use GitHub branch state"
fi

log "deploying branch ${DEPLOY_GIT_BRANCH} on ${DEPLOY_TARGET}"
set +e
timeout --signal=TERM --kill-after=10 "${DEPLOY_SSH_TIMEOUT_SECONDS}" \
    "$DEPLOY_SSH_BIN" bash -s -- \
    "$DEPLOY_REMOTE_DIR" \
    "$DEPLOY_GIT_REMOTE" \
    "$DEPLOY_GIT_BRANCH" \
    "$DEPLOY_RUN_SMOKE" \
    "$DEPLOY_RUN_BROWSER_SMOKE" \
    "$DEPLOY_HEALTH_URL" \
    "$DEPLOY_RTC_URL" \
    "$DEPLOY_HEALTH_RETRIES" \
    "$DEPLOY_HEALTH_SLEEP_SECONDS" \
    "$DEPLOY_ENABLE_SNAPSHOT_FALLBACK" \
    "$LOCAL_HEAD" \
    "$SNAPSHOT_ARCHIVE_REMOTE" <<'REMOTE'
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
ENABLE_SNAPSHOT_FALLBACK="${10}"
LOCAL_HEAD="${11}"
SNAPSHOT_ARCHIVE_REMOTE="${12}"

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

require_cmd git
require_cmd curl
require_cmd docker
test -d "$REMOTE_DIR" || fail "remote directory missing: $REMOTE_DIR"
test -f "$REMOTE_DIR/.env" || fail "missing remote .env in $REMOTE_DIR"

DEPLOY_MODE="git"
SNAPSHOT_BACKUP_DIR=""
SNAPSHOT_ENV_BACKUP=""
GIT_FAILURE_REASON=""

cd "$REMOTE_DIR"

PREVIOUS_COMMIT="$(git rev-parse HEAD 2>/dev/null || cat DEPLOYED_COMMIT 2>/dev/null || echo unknown)"
PREVIOUS_BRANCH="$(git symbolic-ref --short -q HEAD || echo DETACHED)"
CURRENT_REMOTE_URL="$(git remote get-url "$GIT_REMOTE" 2>/dev/null || true)"
TARGET_REF="${GIT_REMOTE}/${GIT_BRANCH}"

deploy_from_snapshot() {
    local timestamp="$1"
    local backup_dir="${REMOTE_DIR}.snapshot-${timestamp}"
    local env_backup="/tmp/quickshare-env-${timestamp}"
    test -f "$SNAPSHOT_ARCHIVE_REMOTE" || fail "snapshot archive missing on remote host: $SNAPSHOT_ARCHIVE_REMOTE"
    cp "${REMOTE_DIR}/.env" "$env_backup"
    cd "$(dirname "$REMOTE_DIR")"
    mv "$REMOTE_DIR" "$backup_dir"
    mkdir -p "$REMOTE_DIR"
    cp "$env_backup" "${REMOTE_DIR}/.env"
    tar -xzf "$SNAPSHOT_ARCHIVE_REMOTE" -C "$REMOTE_DIR"
    printf '%s\n' "$LOCAL_HEAD" > "${REMOTE_DIR}/DEPLOYED_COMMIT"
    SNAPSHOT_BACKUP_DIR="$backup_dir"
    SNAPSHOT_ENV_BACKUP="$env_backup"
    DEPLOY_MODE="snapshot"
    TARGET_COMMIT="$LOCAL_HEAD"
    cd "$REMOTE_DIR"
}

if [[ ! -d "${REMOTE_DIR}/.git" ]]; then
    GIT_FAILURE_REASON="missing_git_repo"
else
    if [[ -z "$CURRENT_REMOTE_URL" ]]; then
        GIT_FAILURE_REASON="missing_git_remote"
    else
        log "remote repo: ${CURRENT_REMOTE_URL}"
        log "fetching ${TARGET_REF}"
        if ! git fetch --prune "$GIT_REMOTE"; then
            GIT_FAILURE_REASON="git_fetch_failed"
        elif ! git rev-parse --verify "$TARGET_REF" >/dev/null 2>&1; then
            GIT_FAILURE_REASON="missing_target_ref"
        fi
    fi
fi

if [[ -n "$GIT_FAILURE_REASON" ]]; then
    if [[ "$ENABLE_SNAPSHOT_FALLBACK" != "1" ]]; then
        fail "git-based deploy unavailable: ${GIT_FAILURE_REASON}"
    fi
    log "git-based deploy unavailable (${GIT_FAILURE_REASON}); falling back to uploaded source snapshot"
    deploy_from_snapshot "$(date +%Y%m%d-%H%M%S)"
fi

if [[ "$DEPLOY_MODE" == "git" ]]; then
    TARGET_COMMIT="$(git rev-parse "$TARGET_REF")"
    # If the server's bare repo is behind (e.g. not yet synced with GitHub),
    # the resolved commit will differ from what we intend to deploy.
    # Fall back to the uploaded snapshot which always carries the correct HEAD.
    if [[ "$TARGET_COMMIT" != "$LOCAL_HEAD" && "$ENABLE_SNAPSHOT_FALLBACK" == "1" ]]; then
        log "remote git has ${TARGET_COMMIT}, expected ${LOCAL_HEAD}; using uploaded snapshot instead"
        deploy_from_snapshot "$(date +%Y%m%d-%H%M%S)"
    fi
fi
ROLLBACK_NEEDED=0

rollback() {
    if [[ "$DEPLOY_MODE" == "snapshot" && -n "$SNAPSHOT_BACKUP_DIR" && -d "$SNAPSHOT_BACKUP_DIR" ]]; then
        log "rolling back snapshot deploy from ${TARGET_COMMIT} to ${PREVIOUS_COMMIT}"
        cd "$(dirname "$REMOTE_DIR")"
        rm -rf "$REMOTE_DIR"
        mv "$SNAPSHOT_BACKUP_DIR" "$REMOTE_DIR"
        cd "$REMOTE_DIR"
        printf '%s\n' "$PREVIOUS_COMMIT" > DEPLOYED_COMMIT
        compose_cmd up --build -d --remove-orphans || true
        return
    fi
    log "rolling back to ${PREVIOUS_BRANCH}:${PREVIOUS_COMMIT}"
    checkout_ref "$PREVIOUS_BRANCH" "$PREVIOUS_COMMIT"
    git reset --hard "$PREVIOUS_COMMIT" >/dev/null
    git clean -fdx -e .env >/dev/null
    printf '%s\n' "$PREVIOUS_COMMIT" > DEPLOYED_COMMIT
    compose_cmd up --build -d --remove-orphans || true
}

if [[ "$DEPLOY_MODE" == "git" ]]; then
    log "checking out ${TARGET_REF} (${TARGET_COMMIT})"
    checkout_ref "$GIT_BRANCH" "$TARGET_REF"
    git reset --hard "$TARGET_REF" >/dev/null
    git clean -fdx -e .env >/dev/null
    printf '%s\n' "$TARGET_COMMIT" > DEPLOYED_COMMIT
else
    log "using uploaded source snapshot commit ${TARGET_COMMIT}"
fi

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

    log "summary: mode=${DEPLOY_MODE} branch=${GIT_BRANCH} previous_commit=${PREVIOUS_COMMIT} deployed_commit=${TARGET_COMMIT} health=passed rtc=${RTC_STATUS} smoke=${SMOKE_STATUS} browser_smoke=${BROWSER_SMOKE_STATUS}"
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
deploy_status=$?
set -e

if [[ "$deploy_status" -eq 124 ]]; then
    fail "remote deploy command timed out after ${DEPLOY_SSH_TIMEOUT_SECONDS}s"
fi

if [[ "$deploy_status" -ne 0 ]]; then
    exit "$deploy_status"
fi

log "deployment complete"
