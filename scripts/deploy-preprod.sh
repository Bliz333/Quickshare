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
DEPLOY_REMOTE_MIRROR_DIR="${DEPLOY_REMOTE_MIRROR_DIR:-/root/quickshare.git}"
DEPLOY_GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"
DEPLOY_GIT_BRANCH="${DEPLOY_GIT_BRANCH:-$CURRENT_BRANCH}"
DEPLOY_RUN_SMOKE="${DEPLOY_RUN_SMOKE:-0}"
DEPLOY_RUN_BROWSER_SMOKE="${DEPLOY_RUN_BROWSER_SMOKE:-0}"
DEPLOY_ENABLE_GIT_BUNDLE_FALLBACK="${DEPLOY_ENABLE_GIT_BUNDLE_FALLBACK:-1}"
DEPLOY_ENABLE_SNAPSHOT_FALLBACK="${DEPLOY_ENABLE_SNAPSHOT_FALLBACK:-1}"
DEPLOY_SSH_TIMEOUT_SECONDS="${DEPLOY_SSH_TIMEOUT_SECONDS:-900}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
DEPLOY_RTC_URL="${DEPLOY_RTC_URL:-http://127.0.0.1:8080/api/public/quickdrop/rtc-config}"
DEPLOY_HEALTH_RETRIES="${DEPLOY_HEALTH_RETRIES:-30}"
DEPLOY_HEALTH_SLEEP_SECONDS="${DEPLOY_HEALTH_SLEEP_SECONDS:-2}"
DEPLOY_MIN_DISK_MB="${DEPLOY_MIN_DISK_MB:-2048}"
DEPLOY_MIN_MEM_MB="${DEPLOY_MIN_MEM_MB:-256}"
DEPLOY_PRUNE_DOCKER_ON_LOW_DISK="${DEPLOY_PRUNE_DOCKER_ON_LOW_DISK:-1}"
DEPLOY_CLEANUP_REMOTE_ARTIFACTS="${DEPLOY_CLEANUP_REMOTE_ARTIFACTS:-1}"

LOCAL_HEAD="$(git rev-parse HEAD)"
LOCAL_REMOTE_HEAD="$(git rev-parse --verify "${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH}" 2>/dev/null || true)"
GIT_BUNDLE_LOCAL="/tmp/quickshare-deploy-${LOCAL_HEAD}.bundle"
GIT_BUNDLE_REMOTE="/root/quickshare-deploy-${LOCAL_HEAD}.bundle"
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
if ! command -v "$DEPLOY_SSH_BIN" >/dev/null 2>&1; then
    if [[ "$DEPLOY_SSH_BIN" == "quickshare-test-ssh" ]]; then
        DEPLOY_SSH_BIN="ssh"
        log "quickshare-test-ssh not found; falling back to plain ssh"
    else
        fail "missing command: $DEPLOY_SSH_BIN"
    fi
fi
if ! command -v "$DEPLOY_SCP_BIN" >/dev/null 2>&1; then
    if [[ "$DEPLOY_SCP_BIN" == "quickshare-test-scp" ]]; then
        DEPLOY_SCP_BIN="scp"
        log "quickshare-test-scp not found; falling back to plain scp"
    else
        fail "missing command: $DEPLOY_SCP_BIN"
    fi
fi
require_cmd timeout

SSH_CMD=("$DEPLOY_SSH_BIN")
if [[ "$(basename "$DEPLOY_SSH_BIN")" == "ssh" ]]; then
    SSH_CMD+=("$DEPLOY_TARGET")
fi

if [[ "$DEPLOY_ENABLE_GIT_BUNDLE_FALLBACK" == "1" ]]; then
    require_cmd "$DEPLOY_SCP_BIN"
    log "preparing git bundle fallback ${GIT_BUNDLE_LOCAL}"
    rm -f "$GIT_BUNDLE_LOCAL"
    git bundle create "$GIT_BUNDLE_LOCAL" --all
    log "uploading git bundle to ${DEPLOY_TARGET}:${GIT_BUNDLE_REMOTE}"
    "$DEPLOY_SCP_BIN" "$GIT_BUNDLE_LOCAL" "${DEPLOY_TARGET}:${GIT_BUNDLE_REMOTE}"
fi

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
    "${SSH_CMD[@]}" bash -s -- \
    "$DEPLOY_REMOTE_DIR" \
    "$DEPLOY_REMOTE_MIRROR_DIR" \
    "$DEPLOY_GIT_REMOTE" \
    "$DEPLOY_GIT_BRANCH" \
    "$DEPLOY_RUN_SMOKE" \
    "$DEPLOY_RUN_BROWSER_SMOKE" \
    "$DEPLOY_HEALTH_URL" \
    "$DEPLOY_RTC_URL" \
    "$DEPLOY_HEALTH_RETRIES" \
    "$DEPLOY_HEALTH_SLEEP_SECONDS" \
    "$DEPLOY_ENABLE_GIT_BUNDLE_FALLBACK" \
    "$DEPLOY_ENABLE_SNAPSHOT_FALLBACK" \
    "$LOCAL_HEAD" \
    "$GIT_BUNDLE_REMOTE" \
    "$SNAPSHOT_ARCHIVE_REMOTE" \
    "$DEPLOY_MIN_DISK_MB" \
    "$DEPLOY_MIN_MEM_MB" \
    "$DEPLOY_PRUNE_DOCKER_ON_LOW_DISK" \
    "$DEPLOY_CLEANUP_REMOTE_ARTIFACTS" <<'REMOTE'
set -euo pipefail

REMOTE_DIR="$1"
REMOTE_MIRROR_DIR="$2"
GIT_REMOTE="$3"
GIT_BRANCH="$4"
RUN_SMOKE="$5"
RUN_BROWSER_SMOKE="$6"
HEALTH_URL="$7"
RTC_URL="$8"
HEALTH_RETRIES="$9"
HEALTH_SLEEP_SECONDS="${10}"
ENABLE_GIT_BUNDLE_FALLBACK="${11}"
ENABLE_SNAPSHOT_FALLBACK="${12}"
LOCAL_HEAD="${13}"
GIT_BUNDLE_REMOTE="${14}"
SNAPSHOT_ARCHIVE_REMOTE="${15}"
DEPLOY_MIN_DISK_MB="${16}"
DEPLOY_MIN_MEM_MB="${17}"
DEPLOY_PRUNE_DOCKER_ON_LOW_DISK="${18}"
DEPLOY_CLEANUP_REMOTE_ARTIFACTS="${19}"

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

available_disk_mb() {
    df -Pm / | awk 'NR==2 {print $4}'
}

available_mem_mb() {
    free -m | awk '/^Mem:/ {print $7}'
}

resource_summary() {
    log "resource snapshot:"
    df -h / /root || true
    free -h || true
    docker system df || true
}

cleanup_transfer_artifacts() {
    rm -f "$GIT_BUNDLE_REMOTE" "$SNAPSHOT_ARCHIVE_REMOTE"
}

ensure_remote_capacity() {
    local stage="$1"
    local min_disk_mb="${DEPLOY_MIN_DISK_MB:-2048}"
    local min_mem_mb="${DEPLOY_MIN_MEM_MB:-256}"
    local prune_on_low_disk="${DEPLOY_PRUNE_DOCKER_ON_LOW_DISK:-1}"
    local disk_mb mem_mb

    disk_mb="$(available_disk_mb)"
    mem_mb="$(available_mem_mb)"
    log "resource check (${stage}): disk_available_mb=${disk_mb} mem_available_mb=${mem_mb}"

    if [[ "$disk_mb" -lt "$min_disk_mb" && "$prune_on_low_disk" == "1" ]]; then
        log "disk below threshold (${disk_mb}MB < ${min_disk_mb}MB); pruning unused Docker images and transfer artifacts"
        cleanup_transfer_artifacts
        docker image prune -af >/dev/null 2>&1 || true
        disk_mb="$(available_disk_mb)"
        mem_mb="$(available_mem_mb)"
        log "resource check (${stage}, after prune): disk_available_mb=${disk_mb} mem_available_mb=${mem_mb}"
    fi

    if [[ "$disk_mb" -lt "$min_disk_mb" ]]; then
        fail "insufficient disk before ${stage}: ${disk_mb}MB available, require at least ${min_disk_mb}MB"
    fi

    if [[ "$mem_mb" -lt "$min_mem_mb" ]]; then
        fail "insufficient memory before ${stage}: ${mem_mb}MB available, require at least ${min_mem_mb}MB"
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
TARGET_REF="${GIT_REMOTE}/${GIT_BRANCH}"
TARGET_COMMIT=""
cd "$REMOTE_DIR"

PREVIOUS_COMMIT="$(git rev-parse HEAD 2>/dev/null || cat DEPLOYED_COMMIT 2>/dev/null || echo unknown)"
PREVIOUS_BRANCH="$(git symbolic-ref --short -q HEAD || echo DETACHED)"
CURRENT_REMOTE_URL="$(git remote get-url "$GIT_REMOTE" 2>/dev/null || true)"

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

update_remote_mirror_from_bundle() {
    test -f "$GIT_BUNDLE_REMOTE" || fail "git bundle missing on remote host: $GIT_BUNDLE_REMOTE"
    if [[ -d "$REMOTE_MIRROR_DIR" ]]; then
        git -C "$REMOTE_MIRROR_DIR" fetch --prune "$GIT_BUNDLE_REMOTE" \
            "refs/heads/*:refs/heads/*" \
            "refs/tags/*:refs/tags/*" >/dev/null 2>&1 || fail "failed to refresh remote mirror from git bundle"
    else
        git clone --bare "$GIT_BUNDLE_REMOTE" "$REMOTE_MIRROR_DIR" >/dev/null 2>&1 || fail "failed to create remote mirror from git bundle"
    fi
}

deploy_from_bundle_mirror_existing_worktree() {
    log "using git bundle mirror fallback via ${REMOTE_MIRROR_DIR}"
    update_remote_mirror_from_bundle
    git fetch "$REMOTE_MIRROR_DIR" "refs/heads/${GIT_BRANCH}:refs/remotes/deploymirror/${GIT_BRANCH}" >/dev/null 2>&1 || fail "branch ${GIT_BRANCH} missing from remote mirror"
    TARGET_REF="refs/remotes/deploymirror/${GIT_BRANCH}"
    TARGET_COMMIT="$(git rev-parse "$TARGET_REF")"
    DEPLOY_MODE="bundle_mirror"
}

bootstrap_worktree_from_bundle_mirror() {
    local timestamp="$1"
    local backup_dir="${REMOTE_DIR}.snapshot-${timestamp}"
    local env_backup="/tmp/quickshare-env-${timestamp}"

    test -f "${REMOTE_DIR}/.env" || fail "missing remote .env in ${REMOTE_DIR}"
    update_remote_mirror_from_bundle
    cp "${REMOTE_DIR}/.env" "$env_backup"
    cd "$(dirname "$REMOTE_DIR")"
    mv "$REMOTE_DIR" "$backup_dir"
    git clone --branch "$GIT_BRANCH" "$REMOTE_MIRROR_DIR" "$REMOTE_DIR" >/dev/null 2>&1 || fail "failed to bootstrap git worktree from remote mirror"
    cp "$env_backup" "${REMOTE_DIR}/.env"
    SNAPSHOT_BACKUP_DIR="$backup_dir"
    SNAPSHOT_ENV_BACKUP="$env_backup"
    DEPLOY_MODE="bundle_mirror_bootstrap"
    cd "$REMOTE_DIR"
    git fetch "$REMOTE_MIRROR_DIR" "refs/heads/${GIT_BRANCH}:refs/remotes/deploymirror/${GIT_BRANCH}" >/dev/null 2>&1 || fail "failed to fetch target branch from remote mirror after bootstrap"
    TARGET_REF="refs/remotes/deploymirror/${GIT_BRANCH}"
    TARGET_COMMIT="$(git rev-parse "$TARGET_REF")"
    printf '%s\n' "$TARGET_COMMIT" > DEPLOYED_COMMIT
}

ensure_remote_capacity "deploy"

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
    if [[ "$ENABLE_GIT_BUNDLE_FALLBACK" == "1" ]]; then
        if [[ "$GIT_FAILURE_REASON" == "missing_git_repo" ]]; then
            log "git-based deploy unavailable (${GIT_FAILURE_REASON}); bootstrapping git worktree from uploaded git bundle"
            bootstrap_worktree_from_bundle_mirror "$(date +%Y%m%d-%H%M%S)"
        else
            deploy_from_bundle_mirror_existing_worktree
        fi
    elif [[ "$ENABLE_SNAPSHOT_FALLBACK" == "1" ]]; then
        log "git-based deploy unavailable (${GIT_FAILURE_REASON}); falling back to uploaded source snapshot"
        deploy_from_snapshot "$(date +%Y%m%d-%H%M%S)"
    else
        fail "git-based deploy unavailable: ${GIT_FAILURE_REASON}"
    fi
fi

if [[ "$DEPLOY_MODE" == "git" ]]; then
    TARGET_COMMIT="$(git rev-parse "$TARGET_REF")"
fi
ROLLBACK_NEEDED=0

rollback() {
    if [[ "$DEPLOY_MODE" == "snapshot" || "$DEPLOY_MODE" == "bundle_mirror_bootstrap" ]]; then
        if [[ -n "$SNAPSHOT_BACKUP_DIR" && -d "$SNAPSHOT_BACKUP_DIR" ]]; then
            log "rolling back ${DEPLOY_MODE} deploy from ${TARGET_COMMIT} to ${PREVIOUS_COMMIT}"
            cd "$(dirname "$REMOTE_DIR")"
            rm -rf "$REMOTE_DIR"
            mv "$SNAPSHOT_BACKUP_DIR" "$REMOTE_DIR"
            cd "$REMOTE_DIR"
            printf '%s\n' "$PREVIOUS_COMMIT" > DEPLOYED_COMMIT
            compose_cmd up --build -d --remove-orphans || true
            return
        fi
    fi
    log "rolling back to ${PREVIOUS_BRANCH}:${PREVIOUS_COMMIT}"
    checkout_ref "$PREVIOUS_BRANCH" "$PREVIOUS_COMMIT"
    git reset --hard "$PREVIOUS_COMMIT" >/dev/null
    git clean -fdx -e .env >/dev/null
    printf '%s\n' "$PREVIOUS_COMMIT" > DEPLOYED_COMMIT
    compose_cmd up --build -d --remove-orphans || true
}

if [[ "$DEPLOY_MODE" == "git" || "$DEPLOY_MODE" == "bundle_mirror" ]]; then
    log "checking out ${TARGET_REF} (${TARGET_COMMIT})"
    checkout_ref "$GIT_BRANCH" "$TARGET_REF"
    git reset --hard "$TARGET_REF" >/dev/null
    git clean -fdx -e .env >/dev/null
    printf '%s\n' "$TARGET_COMMIT" > DEPLOYED_COMMIT
elif [[ "$DEPLOY_MODE" == "bundle_mirror_bootstrap" ]]; then
    log "using git bundle mirror bootstrap commit ${TARGET_COMMIT}"
else
    log "using uploaded source snapshot commit ${TARGET_COMMIT}"
fi

if [[ -x ./scripts/quickshare-resource-check.sh ]]; then
    ./scripts/quickshare-resource-check.sh \
        --ensure \
        --min-disk-mb "${DEPLOY_MIN_DISK_MB}" \
        --min-mem-mb "${DEPLOY_MIN_MEM_MB}" \
        --prune-docker-on-low-disk "${DEPLOY_PRUNE_DOCKER_ON_LOW_DISK}"
else
    ensure_remote_capacity "compose build"
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

if [[ "$DEPLOY_CLEANUP_REMOTE_ARTIFACTS" == "1" ]]; then
    cleanup_transfer_artifacts
fi

if [[ -x ./scripts/quickshare-resource-check.sh ]]; then
    ./scripts/quickshare-resource-check.sh \
        --min-disk-mb "${DEPLOY_MIN_DISK_MB}" \
        --min-mem-mb "${DEPLOY_MIN_MEM_MB}" \
        --report-only
else
    resource_summary
fi

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
