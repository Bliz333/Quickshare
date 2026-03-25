#!/usr/bin/env bash

set -euo pipefail

MIN_DISK_MB=2048
MIN_MEM_MB=256
ENSURE_MODE=0
REPORT_ONLY=0
PRUNE_DOCKER_ON_LOW_DISK=1

usage() {
  cat <<'EOF'
Usage: ./scripts/quickshare-resource-check.sh [options]

Options:
  --ensure                         Prune temporary deploy artifacts and unused Docker images if disk is below threshold, then fail if still below threshold.
  --report-only                    Only print the current resource summary.
  --min-disk-mb <mb>               Minimum acceptable available disk in MB. Default: 2048.
  --min-mem-mb <mb>                Minimum acceptable available memory in MB. Default: 256.
  --prune-docker-on-low-disk <0|1> Whether --ensure may run docker image prune -af. Default: 1.
  -h, --help                       Show this help.
EOF
}

log() {
  printf '[resource-check] %s\n' "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log "missing command: $1"
    exit 1
  }
}

available_disk_mb() {
  df -Pm / | awk 'NR==2 {print $4}'
}

available_mem_mb() {
  if command -v free >/dev/null 2>&1; then
    free -m | awk '/^Mem:/ {print $7}'
    return
  fi

  if command -v vm_stat >/dev/null 2>&1; then
    local page_size free_pages inactive_pages speculative_pages
    page_size="$(vm_stat | awk '/page size of/ {gsub("\\.","",$8); print $8; exit}')"
    free_pages="$(vm_stat | awk '/Pages free/ {gsub("\\.","",$3); print $3; exit}')"
    inactive_pages="$(vm_stat | awk '/Pages inactive/ {gsub("\\.","",$3); print $3; exit}')"
    speculative_pages="$(vm_stat | awk '/Pages speculative/ {gsub("\\.","",$3); print $3; exit}')"
    page_size="${page_size:-4096}"
    free_pages="${free_pages:-0}"
    inactive_pages="${inactive_pages:-0}"
    speculative_pages="${speculative_pages:-0}"
    echo $(( (page_size * (free_pages + inactive_pages + speculative_pages)) / 1024 / 1024 ))
    return
  fi

  log "missing memory reporting command: free or vm_stat"
  exit 1
}

cleanup_temp_artifacts() {
  rm -f /root/quickshare-deploy-*.bundle /root/quickshare-deploy-src-*.tar.gz
}

report() {
  local paths=("/")
  if [[ -d /root ]]; then
    paths+=("/root")
  fi
  df -h "${paths[@]}" || true
  if command -v free >/dev/null 2>&1; then
    free -h || true
  elif command -v vm_stat >/dev/null 2>&1; then
    vm_stat || true
  fi
  if command -v docker >/dev/null 2>&1; then
    docker system df || true
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ensure)
      ENSURE_MODE=1
      ;;
    --report-only)
      REPORT_ONLY=1
      ;;
    --min-disk-mb)
      MIN_DISK_MB="$2"
      shift
      ;;
    --min-mem-mb)
      MIN_MEM_MB="$2"
      shift
      ;;
    --prune-docker-on-low-disk)
      PRUNE_DOCKER_ON_LOW_DISK="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
  shift
done

require_cmd df

disk_mb="$(available_disk_mb)"
mem_mb="$(available_mem_mb)"
log "disk_available_mb=${disk_mb} mem_available_mb=${mem_mb}"
report

if [[ "$REPORT_ONLY" == "1" ]]; then
  exit 0
fi

if [[ "$ENSURE_MODE" == "1" && "$disk_mb" -lt "$MIN_DISK_MB" ]]; then
  log "disk below threshold (${disk_mb}MB < ${MIN_DISK_MB}MB), cleaning temporary deploy artifacts"
  cleanup_temp_artifacts
  if [[ "$PRUNE_DOCKER_ON_LOW_DISK" == "1" ]]; then
    require_cmd docker
    log "pruning unused Docker images"
    docker image prune -af >/dev/null 2>&1 || true
  fi
  disk_mb="$(available_disk_mb)"
  mem_mb="$(available_mem_mb)"
  log "after cleanup: disk_available_mb=${disk_mb} mem_available_mb=${mem_mb}"
  report
fi

if [[ "$ENSURE_MODE" == "1" ]]; then
  if [[ "$disk_mb" -lt "$MIN_DISK_MB" ]]; then
    log "insufficient disk: ${disk_mb}MB available, require at least ${MIN_DISK_MB}MB"
    exit 1
  fi
  if [[ "$mem_mb" -lt "$MIN_MEM_MB" ]]; then
    log "insufficient memory: ${mem_mb}MB available, require at least ${MIN_MEM_MB}MB"
    exit 1
  fi
fi
