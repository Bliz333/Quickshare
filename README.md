# QuickShare

English | [简体中文](README.zh-CN.md)

QuickShare is a Spring Boot file sharing and personal netdisk platform with:

- public sharing links with extraction codes, expiry, and download limits
- a personal netdisk with folders, batch operations, drag-and-drop moves, and quota visibility
- QuickDrop for same-account device transfer, browser direct transfer, and public pickup flows
- an admin console for runtime policy, storage, mail, payment, and user management
- local filesystem and S3-compatible object storage backends
- Office document preview through LibreOffice and PDF.js

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

## Highlights

### User-facing

- File upload, sharing, preview, download, and extraction-code protection
- Nested folders with create, rename, delete, move, batch actions, and drag-and-drop relocation
- Upload deduplication and reference-aware delete behavior
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
./scripts/check-js.sh
./mvnw -q -DskipTests compile
# add the nearest targeted JUnit set for the change
docker-compose up --build -d --remove-orphans
./scripts/quickshare-smoke.sh
./scripts/quickshare-playwright-smoke.sh
```

Notes:

- The remote test machine has limited disk and memory, so resource checks matter.
- After heavy rebuilds, prune temporary artifacts and unused Docker images.
- Full details live in [docs/README.md](docs/README.md) and [docs/TESTING.md](docs/TESTING.md).

## Deployment Notes

- The application image is self-contained and can be built directly from a fresh git checkout.
- `deploy-preprod.sh` supports a Git-based flow when the remote host can read the configured repository.
- For private environments without direct repository access, the current stable alternative is a server-local git mirror / bare repo or the existing snapshot fallback path.

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
