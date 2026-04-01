#!/usr/bin/env bash
# quickshare-alert.sh — Health & disk monitoring for QuickShare
#
# Usage:
#   ./scripts/quickshare-alert.sh                   # stdout report
#   ./scripts/quickshare-alert.sh --webhook URL      # POST alerts to webhook
#   ./scripts/quickshare-alert.sh --dry-run          # show what would alert
#
# Crontab example (every 10 minutes):
#   */10 * * * * /root/quickshare/scripts/quickshare-alert.sh >> /var/log/quickshare-alert.log 2>&1
#
# Exit codes: 0 = OK, 1 = WARNING, 2 = CRITICAL

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:8080}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-15}"
DISK_CRIT_PERCENT="${DISK_CRIT_PERCENT:-5}"
WEBHOOK_URL=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --webhook) WEBHOOK_URL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EXIT_CODE=0
ALERTS=()

# --- 1. Application health endpoint ---
HEALTH_JSON=$(curl -sf --max-time 10 "${APP_URL}/api/health" 2>/dev/null || echo '{}')
APP_STATUS=$(echo "$HEALTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status','UNKNOWN'))" 2>/dev/null || echo "UNREACHABLE")

if [[ "$APP_STATUS" != "UP" ]]; then
  ALERTS+=("CRITICAL: App health status is ${APP_STATUS}")
  EXIT_CODE=2
fi

# Check storage risk level from health response
RISK_LEVEL=$(echo "$HEALTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('storageDiskRiskLevel',''))" 2>/dev/null || echo "")
if [[ "$RISK_LEVEL" == "CRITICAL" ]]; then
  ALERTS+=("CRITICAL: Storage disk risk level is CRITICAL")
  EXIT_CODE=2
elif [[ "$RISK_LEVEL" == "WARNING" ]]; then
  ALERTS+=("WARNING: Storage disk risk level is WARNING")
  [[ $EXIT_CODE -lt 1 ]] && EXIT_CODE=1
fi

# --- 2. Container health ---
for SVC in quickshare-app-1 quickshare-mysql-1 quickshare-redis-1; do
  STATE=$(docker inspect --format='{{.State.Status}}' "$SVC" 2>/dev/null || echo "missing")
  if [[ "$STATE" != "running" ]]; then
    ALERTS+=("CRITICAL: Container ${SVC} is ${STATE}")
    EXIT_CODE=2
  fi
done

# --- 3. System disk usage ---
DISK_USE_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')
DISK_AVAIL=$((100 - DISK_USE_PCT))

if [[ "$DISK_AVAIL" -le "$DISK_CRIT_PERCENT" ]]; then
  ALERTS+=("CRITICAL: System disk ${DISK_AVAIL}% available (threshold: ${DISK_CRIT_PERCENT}%)")
  EXIT_CODE=2
elif [[ "$DISK_AVAIL" -le "$DISK_WARN_PERCENT" ]]; then
  ALERTS+=("WARNING: System disk ${DISK_AVAIL}% available (threshold: ${DISK_WARN_PERCENT}%)")
  [[ $EXIT_CODE -lt 1 ]] && EXIT_CODE=1
fi

# --- Output ---
if [[ ${#ALERTS[@]} -eq 0 ]]; then
  echo "[${TIMESTAMP}] OK: All checks passed (app=${APP_STATUS}, disk=${DISK_AVAIL}% free)"
else
  for alert in "${ALERTS[@]}"; do
    echo "[${TIMESTAMP}] ${alert}"
  done

  # Send webhook if configured
  if [[ -n "$WEBHOOK_URL" && "$DRY_RUN" -eq 0 ]]; then
    BODY=$(printf '%s\n' "${ALERTS[@]}" | python3 -c "import sys,json; print(json.dumps({'text': sys.stdin.read().strip(), 'timestamp': '${TIMESTAMP}'}))")
    curl -sf --max-time 10 -X POST -H 'Content-Type: application/json' -d "$BODY" "$WEBHOOK_URL" >/dev/null 2>&1 || echo "[${TIMESTAMP}] WARNING: Failed to send webhook"
  fi
fi

exit $EXIT_CODE
