# Production vs Pre-production Environments

## Environment Definitions

| | Pre-production | Production |
|---|---|---|
| Purpose | Integration smoke, Playwright regression, deployment validation | Live user traffic |
| Infrastructure | Debian 12 test machine (resource-constrained) | Dedicated server or cloud VM |
| Deployment method | `scripts/deploy-preprod.sh` (git fetch + docker compose) | Same script or manual |
| Rollback | Auto-rollback on health/build failure | Same |

## Configuration Differences

| Variable | Pre-production | Production |
|---|---|---|
| `JWT_SECRET` | Test secret (≥32 chars) | Unique, high-entropy secret — rotate if leaked |
| `STORAGE_TYPE` | `local` | `s3` preferred; `local` only for single-host |
| `S3_ENDPOINT` / `S3_BUCKET` | Not set | Required if `STORAGE_TYPE=s3` |
| `TURN_SERVER_URL` | Pre-production TURN (coturn on test machine) | Production TURN or managed TURN service |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | Test credentials | Production credentials |
| `RECAPTCHA_SECRET` | Test key (if enabled) | Production key |
| `MAIL_*` | May use test SMTP or disabled | Production SMTP |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `ChangeMeAdmin123!` default acceptable for testing | Must be changed |

All variables are set via environment or Docker Compose `.env` file — never committed to the repo.

## Pre-production Baseline

The test machine maintains:
- `/root/quickshare` — git working copy (never revert to a bare snapshot directory)
- A local bare repo as push target for offline deployments
- `docker-compose.yml` driving the app container

To verify the baseline is intact:
```bash
cd /root/quickshare && git status
curl -s http://localhost:8080/api/health | python3 -m json.tool
```

## Release Checklist

Run these steps in order before promoting a build to production:

1. **Health check**
   ```bash
   curl -s http://localhost:8080/api/health
   # Expect: "status": "UP", database/redis both "UP"
   ```

2. **Smoke tests**
   ```bash
   ./scripts/quickshare-smoke.sh
   ```

3. **Playwright regression**
   ```bash
   ./scripts/quickshare-playwright-smoke.sh
   # or: npx playwright test
   ```

4. **Manual key paths** (when smoke alone is insufficient)
   - Login → upload file → share link → download via share link
   - QuickDrop: same-account direct transfer (confirm `direct` or `relay` mode logged)
   - Admin console: storage policy toggle, user list

5. **Disk capacity check**
   ```bash
   curl -s http://localhost:8080/api/health | python3 -m json.tool | grep -i disk
   # storageDiskRiskLevel must be "OK"
   ```

6. **Deploy to production**
   ```bash
   ./scripts/deploy-preprod.sh   # or equivalent production deploy command
   ```

7. **Post-deploy smoke** — repeat steps 1–2 against the production URL.

## Ongoing monitoring & backup

After deployment, set up crontab for automated health checks and backups:

```
# Health & disk alert every 10 minutes
*/10 * * * * /root/quickshare/scripts/quickshare-alert.sh >> /var/log/quickshare-alert.log 2>&1

# Daily MySQL + uploads backup at 03:00
0 3 * * * /root/quickshare/scripts/quickshare-backup.sh >> /var/log/quickshare-backup.log 2>&1
```

See `docs/ops/capacity.md` for threshold details and cleanup procedures.

## Rollback

The deploy script auto-rolls back if health check fails after startup. To manually roll back:

```bash
cd /root/quickshare
git log --oneline -5        # identify last known-good commit
git checkout <commit>       # or reset and redeploy
docker compose up --build -d
```
