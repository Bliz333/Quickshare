#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE_READY_FULL="${RELEASE_READY_FULL:-0}"
RELEASE_READY_SKIP_JS="${RELEASE_READY_SKIP_JS:-0}"
RELEASE_READY_SKIP_TESTS="${RELEASE_READY_SKIP_TESTS:-0}"
RELEASE_READY_SKIP_PACKAGE="${RELEASE_READY_SKIP_PACKAGE:-0}"
RELEASE_READY_TARGETED_TESTS="${RELEASE_READY_TARGETED_TESTS:-ProdSecurityConfigurationValidatorTest,JwtUtilTest,RequestRateLimitServiceImplTest,TransferPairingServiceImplTest,PlanControllerTest,PaymentControllerTest,PaymentServiceImplTest,AdminServiceImplTest,FileControllerTest,FileServiceImplTest,HealthControllerTest,LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,TransferServiceImplTest,UserServiceImplTest}"

log() {
  printf '[release-ready] %s\n' "$*"
}

run_step() {
  local label="$1"
  shift
  log "START ${label}"
  "$@"
  log "PASS ${label}"
}

compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    docker compose "$@"
  fi
}

if [[ "$RELEASE_READY_SKIP_JS" != "1" ]]; then
  run_step "JS syntax baseline" ./scripts/check-js.sh
fi

if [[ "$RELEASE_READY_SKIP_TESTS" != "1" ]]; then
  run_step "Java compile" ./mvnw -q -DskipTests compile
  run_step "targeted JUnit" ./mvnw -q -Dtest="$RELEASE_READY_TARGETED_TESTS" test
fi

if [[ "$RELEASE_READY_SKIP_PACKAGE" != "1" ]]; then
  run_step "package" ./mvnw -q -DskipTests package
fi

if [[ "$RELEASE_READY_FULL" == "1" ]]; then
  run_step "resource preflight" ./scripts/quickshare-resource-check.sh --ensure
  run_step "Docker compose rebuild" compose_cmd up --build -d --remove-orphans
  run_step "repo smoke" ./scripts/quickshare-smoke.sh
  run_step "browser smoke" ./scripts/quickshare-playwright-smoke.sh
  run_step "resource report" ./scripts/quickshare-resource-check.sh --report-only
else
  log "SKIP full runtime gates; set RELEASE_READY_FULL=1 to run resource, Docker, smoke, and browser smoke checks"
fi

log "All selected release readiness checks passed"
