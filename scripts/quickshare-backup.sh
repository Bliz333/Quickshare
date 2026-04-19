#!/usr/bin/env bash
# quickshare-backup.sh — MySQL dump + uploads backup for QuickShare
#
# Usage:
#   ./scripts/quickshare-backup.sh                   # full backup
#   ./scripts/quickshare-backup.sh --dry-run         # show what would happen
#
# Crontab example (daily at 03:00):
#   0 3 * * * /root/quickshare/scripts/quickshare-backup.sh >> /var/log/quickshare-backup.log 2>&1
#
# Environment:
#   BACKUP_DIR          — where to store backups (default: /root/quickshare-backups)
#   BACKUP_RETAIN_DAYS  — days to keep old backups (default: 7)
#   MYSQL_CONTAINER     — container name (default: quickshare-mysql-1)
#   DB_NAME             — database name (default: quickshare)
#   DB_USER             — database user (default: from .env or 'quickshare')
#   DB_PASSWORD          — database password (default: from .env or 'change_me')
#   UPLOADS_VOLUME      — Docker volume name (default: quickshare_quickshare-uploads)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/quickshare-backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-quickshare-mysql-1}"
DB_NAME="${DB_NAME:-quickshare}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-quickshare_quickshare-uploads}"
DRY_RUN=0

# Load .env for DB credentials if available
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  # Safe line-by-line parse: skip comments/blanks, only export simple KEY=VALUE
  while IFS='=' read -r key value; do
    key=$(echo "$key" | xargs)
    [[ -z "$key" || "$key" == \#* ]] && continue
    export "$key=$value"
  done < "${PROJECT_DIR}/.env"
fi

DB_USER="${DB_USER:-${DB_USERNAME:-quickshare}}"
DB_PASSWORD="${DB_PASSWORD:-change_me}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
DATE_DIR="${BACKUP_DIR}/${TIMESTAMP}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting backup..."

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Would create: ${DATE_DIR}/"
  echo "[dry-run] Would dump: ${DB_NAME} from ${MYSQL_CONTAINER}"
  echo "[dry-run] Would tar uploads from volume: ${UPLOADS_VOLUME}"
  echo "[dry-run] Would prune backups older than ${BACKUP_RETAIN_DAYS} days"
  exit 0
fi

mkdir -p "$DATE_DIR"

# --- 1. MySQL dump ---
echo "  Dumping MySQL..."
docker exec "$MYSQL_CONTAINER" \
  mysqldump -u"$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction --routines --triggers \
    "$DB_NAME" | gzip > "${DATE_DIR}/db.sql.gz"

DB_SIZE=$(du -sh "${DATE_DIR}/db.sql.gz" | cut -f1)
echo "  MySQL dump: ${DB_SIZE}"

# --- 2. Uploads volume backup (incremental tar) ---
echo "  Backing up uploads volume..."
UPLOADS_MOUNT=$(docker volume inspect "$UPLOADS_VOLUME" --format='{{.Mountpoint}}' 2>/dev/null || echo "")

if [[ -n "$UPLOADS_MOUNT" && -d "$UPLOADS_MOUNT" ]]; then
  # Use tar with --newer for incremental if a previous backup exists
  PREV_BACKUP=$(find "$BACKUP_DIR" -name "uploads.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')

  if [[ -n "$PREV_BACKUP" ]]; then
    PREV_DATE=$(stat -c '%Y' "$PREV_BACKUP" 2>/dev/null || echo "0")
    PREV_READABLE=$(date -d "@${PREV_DATE}" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
    echo "  Incremental since: ${PREV_READABLE}"
    tar czf "${DATE_DIR}/uploads.tar.gz" \
      --newer-mtime="@${PREV_DATE}" \
      -C "$UPLOADS_MOUNT" . 2>/dev/null || true
  else
    echo "  Full backup (no previous found)"
    tar czf "${DATE_DIR}/uploads.tar.gz" -C "$UPLOADS_MOUNT" . 2>/dev/null || true
  fi

  UPLOADS_SIZE=$(du -sh "${DATE_DIR}/uploads.tar.gz" | cut -f1)
  echo "  Uploads backup: ${UPLOADS_SIZE}"
else
  echo "  WARNING: Uploads volume not found at expected mount point, skipping"
fi

# --- 3. Prune old backups ---
PRUNED=0
while IFS= read -r old_dir; do
  rm -rf "$old_dir"
  PRUNED=$((PRUNED + 1))
done < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_RETAIN_DAYS}" 2>/dev/null)

echo "  Pruned ${PRUNED} old backup(s)"

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup complete: ${DATE_DIR} (total backups: ${TOTAL_SIZE})"
