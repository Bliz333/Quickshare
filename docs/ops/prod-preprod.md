# Production and Pre-production

## Environment Roles

| | Pre-production | Production |
| --- | --- | --- |
| Purpose | Integration, deployment, smoke, live browser validation | Real user traffic and data |
| Allowed changes | Task/review branches in an isolated target | Only an explicitly authorized release |
| Data | Disposable or sanitized | Backed up, retained, audited |
| Deployment | `scripts/deploy-preprod.sh` on the configured test target | Project-specific production runbook |
| Failure handling | Rebuild/retry within the isolated target | Controlled rollback with data compatibility check |

Do not use a historical test host description as current infrastructure truth. Real targets, SSH identities and credentials live outside Git.

## Configuration Differences

Use the exact names from `.env.example`:

| Area | Pre-production | Production |
| --- | --- | --- |
| `JWT_SECRET`, `SETTING_ENCRYPT_KEY` | Unique test-only values | Unique high-entropy production values; preserve encryption key continuity |
| `STORAGE_TYPE` | `local` or isolated MinIO/S3 | S3-compatible recommended for multi-host; local requires file backups |
| `QUICKDROP_STUN_URLS`, `QUICKDROP_TURN_*` | Test ICE service | Production ICE service and separately protected credentials |
| `RECAPTCHA_*` / runtime captcha | Test keys or disabled | Domain-bound production keys |
| `MAIL_*` | Test inbox/provider | Production SMTP and monitored delivery |
| `BOOTSTRAP_ADMIN_*` | Temporary bootstrap only | Disabled after controlled bootstrap |
| `APP_BIND_HOST` | As required by isolated host | Loopback/private address behind nginx where possible |

Never reuse production JWT, encryption, database, payment, mail or TURN secrets in pre-production.

## Pre-production Deployment

The existing script can fetch the current branch or use git-bundle/snapshot fallbacks. Run it from a clean, checked-out task branch at the exact candidate commit:

```bash
git status --short
candidate_sha="$(git rev-parse HEAD)"
DEPLOY_RUN_SMOKE=1 \
DEPLOY_RUN_BROWSER_SMOKE=1 \
./scripts/deploy-preprod.sh
```

Do not set `DEPLOY_GIT_BRANCH` to a branch other than the current checkout: the snapshot fallback packages current `HEAD`. The configured remote should remain a real Git worktree backed by a local mirror. `compose.yaml` is the repository Compose file; do not document or depend on an untracked `docker-compose.yml` copy.

The script runs health, RTC, smoke and browser smoke inside the configured remote checkout. On success, read its final `[deploy] summary:` and require `deployed_commit` to equal the captured `candidate_sha`, with `health=passed`, `rtc=passed`, `smoke=passed` and `browser_smoke=passed`. Do not follow this with local loopback curls or a local smoke run: those would validate the caller's machine, not the deployed target. Independent remote inspection must reuse the configured transport and `DEPLOY_REMOTE_DIR`, never a hardcoded helper or path.

Use `./scripts/quickshare-resource-check.sh --report-only` before and after expensive rebuilds on constrained hosts.

## Production Promotion

Production is not “run the preprod script against another hostname.” Before an authorized release:

1. Freeze and record the reviewed commit SHA.
2. Back up MySQL and the active file backend; verify backup availability.
3. Confirm Flyway migrations are compatible with rollback expectations.
4. Deploy through the environment's approved runbook.
5. Verify `/api/health`, core API smoke, login/upload/share/download, `/ws/transfer`, storage and error logs.
6. Keep the previous application artifact/commit available until the observation window closes.

First-time single-host setup is documented in `production-deployment.md`; nginx/TLS in `https-proxy.md`.

## Rollback Boundary

A rollback must restore a known application version while preserving database and file compatibility. Do not `git reset --hard` or rewrite a shared branch as a rollback mechanism. If a migration is not backward compatible, use a prepared corrective migration or restore plan under explicit production authorization.

## Ongoing Operations

- Health and disk alerting plus backup examples: `capacity.md`
- Proxy/WebSocket/TLS: `https-proxy.md`
- Platform and secret boundaries: `../ai/platform.md`

Any production publish/rollback, DNS/firewall/systemd change, key rotation or data deletion follows the global irreversible-action authorization rule.
