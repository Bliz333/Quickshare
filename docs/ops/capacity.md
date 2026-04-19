# Capacity Monitoring and Cleanup

## Disk Risk Thresholds

Implemented in `LocalStorageRuntimeInspector`:

| `storageDiskRiskLevel` | Condition |
|---|---|
| `OK` | usable disk ≥ 15% |
| `WARNING` | usable disk ≤ 15% |
| `CRITICAL` | usable disk ≤ 5% |

## Health Check

```bash
curl -s http://localhost:8080/api/health | python3 -m json.tool
```

Key fields in the response:

| Field | Meaning |
|---|---|
| `status` | `UP` if database + Redis both healthy |
| `storageDiskUsablePercent` | Remaining disk % (local storage only) |
| `storageDiskRiskLevel` | `OK` / `WARNING` / `CRITICAL` |
| `storageDiskUsableBytes` | Bytes still available |
| `storageConnectionStatus` | `local`, `connected`, or `error: ...` (S3) |

## System-level disk check

```bash
df -h /
docker system df
```

## Cleanup SOP

### Unused Docker artifacts
```bash
docker image prune -f
docker container prune -f
docker volume prune -f
```

### Application upload directory
Orphaned files (uploaded but not linked to any DB record) accumulate in the upload directory over time. To find and review them:

```bash
# Show total size
du -sh /path/to/uploads

# List files older than 7 days not referenced by DB (manual cross-check)
find /path/to/uploads -type f -mtime +7
```

No automated purge is implemented yet — cross-reference against `file_info` table before deleting.

### Log rotation
Spring Boot writes to stdout by default when run inside Docker. Logs are managed by Docker's log driver.

`compose.yaml` already configures automatic log rotation for all services (`json-file`, `max-size: 10m`, `max-file: 3`). Each container keeps at most ~30 MB of logs.

```bash
# Check current log size
docker inspect --format='{{.LogPath}}' quickshare-app-1 | xargs du -sh

# Truncate if needed (zero-downtime safe, rarely necessary with rotation enabled)
docker inspect --format='{{.LogPath}}' quickshare-app-1 | xargs truncate -s 0
```

## Automated monitoring and backup

### Alert script

`scripts/quickshare-alert.sh` checks app health, container status, and system disk usage.

```bash
./scripts/quickshare-alert.sh                    # stdout report
./scripts/quickshare-alert.sh --webhook URL      # POST to webhook on alert
./scripts/quickshare-alert.sh --dry-run          # show what would alert
```

Crontab (every 10 minutes):
```
*/10 * * * * /root/quickshare/scripts/quickshare-alert.sh >> /var/log/quickshare-alert.log 2>&1
```

### Backup script

`scripts/quickshare-backup.sh` dumps MySQL + tars the uploads volume with incremental support and retention.

```bash
./scripts/quickshare-backup.sh                   # full backup
./scripts/quickshare-backup.sh --dry-run         # preview
```

Crontab (daily at 03:00):
```
0 3 * * * /root/quickshare/scripts/quickshare-backup.sh >> /var/log/quickshare-backup.log 2>&1
```

Environment overrides: `BACKUP_DIR` (default `/root/quickshare-backups`), `BACKUP_RETAIN_DAYS` (default 7).

## Monitoring frequency

- Run `curl /api/health` after every deployment.
- When `storageDiskRiskLevel` is `WARNING`: schedule cleanup within 24 hours.
- When `storageDiskRiskLevel` is `CRITICAL`: immediate cleanup required before the next upload is accepted.
