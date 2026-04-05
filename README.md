# QuickShare

<div align="center">

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://adoptium.net/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A modern file sharing and storage system with admin console, S3-compatible storage, and Office document preview.

</div>

## Features

- **File Sharing** — Upload files, generate share links with extraction codes, expiration, and download limits
- **Folder Organization** — Nested folders with create/rename/delete/move support, batch actions, drag-and-drop relocation, and browser-history-aware navigation inside the netdisk UI
- **Smart Upload Deduplication** — Re-uploading the same file in the same folder returns the existing record; identical content across different names reuses the same physical storage object
- **Guest Upload** — Anonymous users can upload and share files without registration when the runtime policy allows it
- **Plans & Payments** — Public pricing page with provider-aware payment methods, logged-in purchase flow, user order history, and a payment result page with manual/automatic status refresh
- **QuickDrop MVP** — Signed-in users can send files between their own devices without pairing codes, same-account targets now auto-negotiate browser direct transfer before falling back to server relay, anonymous/public pickup links are available without login, temporary pairing supports browser-to-browser direct transfer with resumable missing-chunk continuation, the same-account inbox/outgoing view now runs on a server-backed unified task model with direct-attempt write-back, public/anonymous paired direct transfers also write back a server-side pair-task record, task details now expose attempt lifecycle reasons/timestamps plus save-to-netdisk feedback, and the current QuickDrop page has been simplified toward a mode-first UI with a single content chooser entry, a center pairing stage, and a secondary history page instead of an always-open task area
- **Quota & VIP Visibility** — The netdisk sidebar shows storage usage, monthly download usage, VIP status, and a direct upgrade entry
- **Office Preview** — Word/Excel/PowerPoint documents converted to PDF via LibreOffice, viewed in the built-in PDF.js viewer
- **Admin Console** — Hidden-path admin panel for managing users, files, shares, payments, SMTP, storage, and runtime policies, with runtime storage visibility for local disk capacity and risk level
- **Storage Backends** — Local filesystem or S3-compatible storage (AWS S3, MinIO, Cloudflare R2), switchable from the admin panel
- **Quota Model** — User storage and download limits are logical quotas enforced by the app on top of a shared storage backend; the system does not auto-provision separate physical capacity per user
- **Email System** — Runtime SMTP configuration, multi-locale email templates, test mail, and admin announcement emails with delivery statistics
- **Security** — JWT auth, role-based access (USER/ADMIN), rate limiting, Google reCAPTCHA or Cloudflare Turnstile, AES-encrypted sensitive settings
- **Multi-language** — English and Chinese UI with runtime switching
- **Dark/Light Theme** — Responsive design with theme toggle

## Quick Start

### Docker Compose (Recommended)

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, SETTING_ENCRYPT_KEY, and optional bootstrap admin credentials

docker compose up --build -d
# Open http://localhost:8080
# Admin (hidden path, not linked from public UI): set BOOTSTRAP_ADMIN_* in .env first, then open /console/{ADMIN_CONSOLE_SLUG}
# Transfer (same-account device transfer): http://localhost:8080/transfer.html
# Transfer Share (public pickup link): http://localhost:8080/transfer-share.html
# Legacy aliases still work: /quickdrop.html and /quickdrop-share.html
```

### Local Development

Prerequisites: Java 17+, Maven 3.6+, MySQL 8.0+, Redis 6.0+

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE quickshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Configure (copy and fill in your settings)
cp src/main/resources/application-local.example.yml src/main/resources/application-local.yml

# Run
mvn spring-boot:run -Dspring-boot.run.profiles=local

# Run tests (see docs/TESTING.md for the recommended WSL2 workflow)
mvn test
```

## Testing

Recommended verification flow is documented in `docs/TESTING.md`.

Current project acceptance is remote-first: use the local machine for editing/pushing, and run compile/tests/deploy validation on the Debian test server. The currently verified server baseline is JDK 17, Maven 3.8.7, Node 18 / npm 9, Docker, and `docker-compose`.

- Docs-only changes: diff review and consistency check
- Frontend changes: `./scripts/check-js.sh` or `node --check` on the changed JS files
- Backend changes: `./mvnw -q -DskipTests compile`
- User-facing flow changes: `docker compose up --build -d` plus `./scripts/quickshare-smoke.sh`
- Small milestone acceptance: add the nearest Playwright spec for the changed page or flow

In the current WSL2 environment, full `mvn test` is not the only acceptance gate due to Mockito / ByteBuddy self-attach limitations.

Small milestone baseline:

```bash
./scripts/check-js.sh
./mvnw -q -DskipTests compile
./scripts/quickshare-smoke.sh
```

Smoke script examples:

```bash
./scripts/quickshare-smoke.sh
SMOKE_UP=1 ./scripts/quickshare-smoke.sh
SMOKE_MODE=container SMOKE_DOCKER_CONTAINER=quickshare-app-1 ./scripts/quickshare-smoke.sh
```

Optional preprod deploy example:

```bash
./scripts/deploy-preprod.sh
DEPLOY_GIT_BRANCH=main ./scripts/deploy-preprod.sh
DEPLOY_RUN_SMOKE=1 ./scripts/deploy-preprod.sh
DEPLOY_RUN_SMOKE=1 DEPLOY_RUN_BROWSER_SMOKE=1 ./scripts/deploy-preprod.sh
```

When the remote host can read the configured Git remote, `deploy-preprod.sh` SSHes to the server, `git fetch/reset`s the target branch in `/root/quickshare`, then runs `docker compose up --build -d`. By default it deploys the current local branch name; set `DEPLOY_GIT_BRANCH=main` when you want the server to track `main`.
If the SSH session stalls on network/auth issues, use `DEPLOY_SSH_TIMEOUT_SECONDS` to cap how long the local wrapper waits.
For private/internal environments where the remote host cannot yet fetch the private repo, leave `DEPLOY_ENABLE_SNAPSHOT_FALLBACK=1` or maintain a server-local git mirror so deployments can continue without exposing long-lived GitHub credentials on the test box.

Default host-mode smoke now covers login, storage/order probes, folder create/move/delete, upload deduplication, owned-file download verification, share creation, extract-code validation, public download accounting, and API-level batch move/delete validation. Container mode remains the fallback when host port forwarding is unstable.

The app Docker image is now self-contained: a fresh Git checkout can be deployed with `docker compose up --build -d` without prebuilding `target/*.jar` on the host.

Dockerized browser smoke for environments without local Node/Chromium:

```bash
./scripts/quickshare-playwright-smoke.sh
PLAYWRIGHT_TEST_TARGET=tests/e2e/quickdrop.spec.js ./scripts/quickshare-playwright-smoke.sh
EXPECT_QUICKDROP_FINAL_MODE=direct ./scripts/quickshare-playwright-smoke.sh
```

`quickshare-playwright-smoke.sh` now passes through `EXPECT_QUICKDROP_FINAL_MODE`, so internal preprod runs can optionally fail unless the real-browser QuickDrop task stays `direct`.

Minimal browser automation baseline:

```bash
npm install
npx playwright install chromium
npx playwright test tests/e2e
npx playwright test tests/e2e/netdisk-drag.spec.js
npx playwright test tests/e2e/quickdrop.spec.js
npx playwright test tests/e2e/quickdrop-real.spec.js
```

Current Playwright coverage already includes real drag-and-drop move flow, selection-mode batch move/delete dialogs, the pricing page, payment-result page states, register-page captcha provider switching, the QuickDrop same-account/public-share/direct-transfer baseline, the simplified QuickDrop mode-first page flow, the secondary history page interaction, direct-task merge into the main inbox/outgoing view, single-row `Direct -> Relay` task collapse, and a real two-page same-account browser transfer landing in the unified task list.

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2, Java 17, Spring Security, JWT |
| Database | MySQL 8 + MyBatis Plus 3.5.9, Flyway migrations |
| Cache | Redis (session, rate limiting, verification codes) |
| Storage | Local filesystem or S3-compatible (configurable) |
| Email | Spring Mail with runtime SMTP config + templates |
| Preview | LibreOffice headless + PDF.js viewer |
| Frontend | Vanilla JS, HTML5, CSS3, Font Awesome 6 |
| CI | GitHub Actions (build, test, JS syntax check) |

## Configuration

All settings can be configured via environment variables. See `.env.example` for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required) | JWT signing key (min 32 chars) |
| `SETTING_ENCRYPT_KEY` | (optional) | AES key for encrypting sensitive DB settings |
| `STORAGE_TYPE` | `local` | `local` or `s3` |
| `S3_ENDPOINT` | | S3-compatible endpoint URL |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | | S3 credentials |
| `S3_BUCKET` | | S3 bucket name |
| `BOOTSTRAP_ADMIN_ENABLED` | `true` | Create admin account on first startup |
| `ADMIN_CONSOLE_SLUG` | `quickshare-admin` | Hidden admin panel URL path |
| `REGISTRATION_EMAIL_VERIFICATION_ENABLED` | `false` | Require email verification for registration |
| `QUICKDROP_PRESENCE_TIMEOUT_SECONDS` | `45` | Presence timeout used for same-account device discovery |
| `QUICKDROP_TRANSFER_TTL_HOURS` | `72` | Expiration window for QuickDrop transfer sessions |
| `QUICKDROP_CHUNK_SIZE_BYTES` | `2097152` | Default chunk size used by resumable QuickDrop uploads |
| `QUICKDROP_DIRECT_TRANSFER_ENABLED` | `true` | Enable WebRTC-based paired direct transfer |
| `QUICKDROP_STUN_URLS` | `stun:stun.l.google.com:19302` | Comma-separated STUN servers for QuickDrop direct transfer |
| `QUICKDROP_TURN_URLS` | | Preferred comma-separated TURN URLs, usually both `udp` and `tcp`, for higher public-network direct-transfer success rate |
| `QUICKDROP_TURN_URL` | | Legacy single TURN URL fallback when only one relay address is available |
| `QUICKDROP_TURN_USERNAME` / `QUICKDROP_TURN_PASSWORD` | | TURN credentials used by QuickDrop direct transfer |

Storage, SMTP, email templates, rate limits, CORS, upload/preview policies, and registration settings can all be changed at runtime from the admin console.

## Admin Console

Access at `/console/{ADMIN_CONSOLE_SLUG}` (default: `/console/quickshare-admin`). Public pages do not expose an admin-entry button.

Capabilities:
- **Users** — List, create, delete, change roles
- **Files & Shares** — Browse all files, force-delete, disable share links
- **File Operations** — Move user files/folders between directories, deduplicate storage, and keep deletes reference-aware
- **Plans & Orders** — Manage plans, payment providers, and orders; manual paid/refunded actions now enforce safer order-state transitions and quota rollback
- **Storage** — Switch between local and S3 storage, test connection
- **SMTP** — Configure mail server, send test email
- **Email Templates** — Edit verification code email per language
- **Announcements** — Send email to all or selected users, with matched/deliverable/skipped/success/fail feedback
- **Policies** — Rate limits, CORS, upload limits, preview settings, registration controls
- **Console Access** — Change the hidden admin URL slug

## API Overview

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/register` | No | Register user (email verification optional by runtime policy) |
| `POST /api/auth/login` | No | Login, returns JWT token |
| `GET /api/public/plans` | No | List active purchasable plans for the pricing page |
| `GET /api/public/payment-options` | No | Show the current default payment provider and supported pay types for the pricing page |
| `POST /api/upload` | Optional | Upload file (guest or authenticated) |
| `POST /api/share` | Optional | Create share link |
| `GET /api/share/{code}` | No | Get share info |
| `GET /api/download/{code}` | No | Download shared file |
| `GET /api/preview/{code}` | No | Preview shared file (PDF/Office/image/text) |
| `GET /api/files` | Yes | List user's files |
| `GET /api/files/{id}/preview` | Yes | Preview own file |
| `GET /api/files/{id}/download` | Yes | Download own file |
| `PUT /api/files/{id}/move` | Yes | Move own file to another folder |
| `POST /api/folders` | Yes | Create folder |
| `GET /api/folders/all` | Yes | List all folders for navigation/move targets |
| `PUT /api/folders/{id}/move` | Yes | Move own folder to another folder |
| `POST /api/payment/create` | Yes | Create a payment order and receive the provider redirect URL |
| `GET /api/payment/order/{orderNo}` | Yes | Query the current user's order status for the payment result page |
| `GET /api/payment/orders` | Yes | List the current user's own orders |
| `POST /api/transfer/sync` | Yes | Refresh the current device presence and list same-account devices plus transfer/task state |
| `POST /api/transfer/transfers` | Yes | Create a same-account transfer session |
| `PUT /api/transfer/transfers/{id}/chunks/{chunkIndex}` | Yes | Upload or resume a transfer chunk |
| `GET /api/transfer/transfers/{id}/download` | Yes | Download a completed transfer addressed to the current account |
| `POST /api/transfer/transfers/{id}/save` | Yes | Save an incoming transfer into the current user's netdisk |
| `POST /api/transfer/tasks/direct-attempts` | Yes | Write back same-account browser direct-attempt state into the unified transfer task |
| `DELETE /api/transfer/tasks/{id}` | Yes | Delete a unified transfer task and its relay-side records |
| `DELETE /api/transfer/tasks/{id}/direct-attempts/{clientTransferId}` | Yes | Remove one direct-attempt record from a unified transfer task |
| `POST /api/transfer/direct-sessions` | Yes | Create or reuse a same-account direct-link session between two devices |
| `POST /api/public/transfer/shares` | No | Create a public pickup session without logging in |
| `PUT /api/public/transfer/shares/{token}/chunks/{chunkIndex}` | No | Upload or resume a chunk for a public share |
| `GET /api/public/transfer/shares/{token}` | No | Query public share status for the pickup page |
| `POST /api/public/transfer/pair-tasks/direct-attempts` | No | Write back public / anonymous paired direct-transfer state into a server-side pair task |
| `DELETE /api/public/transfer/pair-tasks/{id}/direct-attempts/{clientTransferId}` | No | Remove one public paired direct-attempt record from a pair task |
| `POST /api/public/transfer/pair-codes` | Optional | Create a temporary match code for direct pairing |
| `POST /api/public/transfer/pair-codes/{code}/claim` | Optional | Claim a match code and bind the pair session |
| `GET /api/public/transfer/rtc-config` | No | Fetch the current STUN/TURN config for direct transfer |
| `POST /api/transfer/public-shares/{token}/save` | Yes | Save a public share into the current user's netdisk |
| Legacy aliases | Mixed | `/api/quickdrop/**`, `/api/public/quickdrop/**`, and `/ws/quickdrop` remain supported for backward compatibility |
| `GET /api/health` | No | Health check (DB, Redis, storage mode, and local upload-dir / disk metrics / risk level when using local storage) |
| `GET /api/admin/*` | Admin | Admin management endpoints |

## Database

Schema managed by Flyway. Initial migration: `src/main/resources/db/migration/V1__initial_schema.sql`.

Tables include `user`, `file_info`, `share_link`, `system_setting`, `plan`, `payment_provider`, `payment_order`, and `flyway_schema_history`.

For existing databases, Flyway baselines automatically (`baseline-on-migrate: true`).

## License

[MIT License](LICENSE)
