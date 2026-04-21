# QuickShare

English | [简体中文](README.zh-CN.md)

QuickShare is a Spring Boot file sharing and personal netdisk platform with:

- public sharing links with extraction codes, expiry, and download limits
- a personal netdisk with folders, batch operations, drag-and-drop moves, and quota visibility
- QuickDrop for same-account device transfer, browser direct transfer, and public pickup flows
- an admin console for runtime policy, storage, mail, payment, and user management
- local filesystem and S3-compatible object storage backends
- Office document preview through LibreOffice and PDF.js
- a tracked Expo / React Native mobile client in `mobile/` with generated native Android and iOS projects

## Current State

- `main` now tracks the validated hardening baseline.
- The project has moved past the initial build-out phase and is now in maintenance, UX polish, and regression hardening.
- The current remote validation baseline is:
  - Debian 12
  - OpenJDK 17
  - Maven 3.8.7
  - Node 18 / npm 9
  - Docker plus `docker-compose`
- The latest remote browser smoke confirmed a real QuickDrop same-account transfer finishing as `direct`, not just `relay`.
- The repository also now contains a tracked mobile client under `mobile/`, plus generated native Android and iOS projects under `mobile/android/` and `mobile/ios/`.

## Mobile Client

The repository includes a checked-in mobile app:

- Expo / React Native app entry: `mobile/App.tsx`
- Mobile source tree: `mobile/src/`
- Native Android project: `mobile/android/`
- Native iOS project: `mobile/ios/`

Current verified mobile baseline includes:

- guest home/share access and login-gated netdisk
- Google sign-in entry and registration flow
- file browsing, upload, preview, download, and share-link creation
- pickup lookup plus save-to-netdisk
- same-account transfer sync with incoming/outgoing task visibility
- Android debug/release builds, emulator launch, and payment deep-link validation
- iOS readiness checks plus CI-backed simulator build/install/launch proof

See also:

- `docs/mobile/README.md`
- `docs/mobile/testing.md`
- `docs/mobile/android.md`
- `docs/mobile/ios.md`
- `docs/mobile/compatibility.md`

## Highlights

### User-facing

- File upload, sharing, preview, download, and extraction-code protection
- Nested folders with create, rename, delete, move, batch actions, and drag-and-drop relocation
- Upload deduplication and reference-aware delete behavior
- Inline file preview in the homepage receive modal, plus embedded PDF/Office viewing on web preview surfaces
- Pricing page, payment result page, user order history, and quota / VIP visibility
- Runtime-switchable captcha provider: Google reCAPTCHA or Cloudflare Turnstile

### QuickDrop

- Same-account device discovery without pairing codes
- Browser direct transfer before relay fallback
- Public pickup links and anonymous paired direct transfer
- Server-backed unified task model with direct-attempt write-back
- Task detail lifecycle with stage, failure reason, fallback reason, and save-to-netdisk feedback

### Admin-facing

- Hidden-path admin console
- Runtime policy management for registration, upload, preview, CORS, and rate limits
- SMTP configuration, localized email templates, and announcement delivery stats
- Plan, payment provider, order, and quota management
- Storage visibility for local disk capacity / risk level and S3 connection status

## Quick Start

### Docker Compose

```bash
cp .env.example .env
# Edit .env and set at least:
# - JWT_SECRET
# - SETTING_ENCRYPT_KEY
# Optional:
# - BOOTSTRAP_ADMIN_*
# - STORAGE_TYPE=s3 and related S3_* values

docker compose up --build -d
# If your host uses the legacy binary:
# docker-compose up --build -d
# Open http://localhost:8080
# Admin (hidden path, not linked from public UI): set BOOTSTRAP_ADMIN_* in .env first, then open /console/{ADMIN_CONSOLE_SLUG}
# Homepage quick transfer: http://localhost:8080/
# Public pickup / share page: http://localhost:8080/share.html
# Legacy aliases still work: /quickdrop.html and /quickdrop-share.html
```

Open:

- App: `http://localhost:8080`
- Netdisk: `http://localhost:8080/netdisk.html`
- QuickDrop: `http://localhost:8080/quickdrop.html`
- QuickDrop Share: `http://localhost:8080/quickdrop-share.html`
- Pricing: `http://localhost:8080/pricing.html`
- Admin console: `http://localhost:8080/console/{ADMIN_CONSOLE_SLUG}`

### Local Development

Prerequisites:

- Java 17+
- Maven 3.6+
- MySQL 8+
- Redis 6+

```bash
mysql -u root -p -e "CREATE DATABASE quickshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cp src/main/resources/application-local.example.yml src/main/resources/application-local.yml
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

## Configuration

The full environment-variable list lives in [`.env.example`](.env.example).

Important settings:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | JWT signing key |
| `SETTING_ENCRYPT_KEY` | Encrypts sensitive settings stored in the database |
| `STORAGE_TYPE` | `local` or `s3` |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | S3-compatible storage settings |
| `BOOTSTRAP_ADMIN_ENABLED` | Creates the initial admin account on startup |
| `ADMIN_CONSOLE_SLUG` | Hidden admin path segment |
| `REGISTRATION_EMAIL_VERIFICATION_ENABLED` | Enables email verification during registration |
| `QUICKDROP_STUN_URLS` | STUN servers for QuickDrop direct transfer |
| `QUICKDROP_TURN_URLS` | Preferred TURN URLs for public-network direct transfer |
| `QUICKDROP_TURN_USERNAME`, `QUICKDROP_TURN_PASSWORD` | TURN credentials |

## Validation and Testing

The project now uses a remote-first validation workflow:

- edit and push locally
- compile, test, deploy, and verify on the remote Debian test server

Recommended acceptance flow:

```bash
./scripts/quickshare-resource-check.sh --ensure
./scripts/check-js.sh
./mvnw -q -DskipTests compile
# add the nearest targeted JUnit set for the change
docker-compose up --build -d --remove-orphans
./scripts/quickshare-smoke.sh
./scripts/quickshare-playwright-smoke.sh
```

### API Endpoint Reference

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

Notes:

- The remote test machine has limited disk and memory, so resource checks matter.
- `scripts/quickshare-resource-check.sh` is the repo-level resource snapshot / low-disk guard for the test server.
- After heavy rebuilds, prune temporary artifacts and unused Docker images.
- Full details live in [docs/README.md](docs/README.md) and [docs/TESTING.md](docs/TESTING.md).

## Deployment Notes

- The application image is self-contained and can be built directly from a fresh git checkout.
- `deploy-preprod.sh` now:
  - falls back to plain `ssh` / `scp` when local helper commands are absent
  - prefers a git-bundle-to-remote-mirror path before dropping to raw snapshot extraction
  - performs remote disk / memory checks before build and prints a resource summary after validation
- For private environments without direct repository access, the current stable alternative is a server-local git mirror / bare repo, with snapshot fallback kept as the last resort.

## Project Docs

- [README.zh-CN.md](README.zh-CN.md): Chinese version of the top-level overview
- [docs/README.md](docs/README.md): English docs hub
- [docs/README.zh-CN.md](docs/README.zh-CN.md): Chinese docs hub
- [docs/STATUS.md](docs/STATUS.md): Current Chinese status snapshot
- [docs/TESTING.md](docs/TESTING.md): Detailed Chinese testing and acceptance workflow
- [docs/PLAN.md](docs/PLAN.md): Current Chinese roadmap / next-stage priorities
- [docs/CHANGELOG.md](docs/CHANGELOG.md): Change log
- [docs/archive](docs/archive): Detailed milestone and session records

## Architecture

| Layer | Stack |
| --- | --- |
| Backend | Spring Boot 3.2, Spring Security, JWT |
| Data | MySQL 8, MyBatis Plus, Flyway |
| Cache | Redis |
| Storage | Local filesystem or S3-compatible object storage |
| Preview | LibreOffice headless plus PDF.js |
| Frontend | Vanilla JS, HTML, CSS |
| Validation | JUnit, repo smoke scripts, Playwright, Dockerized browser smoke |

## License

[MIT License](LICENSE)
