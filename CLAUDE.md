# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## QuickShare - File Sharing System

Spring Boot 3.2.0 / Java 17 file-sharing platform. Users can upload, organize, and share files via secure links. Supports authenticated users, guests, QuickDrop device-to-device transfers, subscription plans, and an admin console.

## Development Commands

```bash
# Build (compile only, no tests)
./mvnw -q -DskipTests compile

# Run all tests (see WSL2 note below)
mvn test

# Run targeted tests
./mvnw -q -Dtest=FileServiceImplTest,FileControllerTest test

# Run the application (local profile)
mvn spring-boot:run -Dspring-boot.run.profiles=local

# Package
mvn clean package
java -jar target/quickshare-1.0.0.jar

# Docker Compose (recommended for full-stack testing)
docker compose up --build -d
docker compose up --build -d app   # rebuild app only
```

**Local dev setup:**
1. Copy `.env.example` → `.env`, set `JWT_SECRET` (min 32 chars) and `SETTING_ENCRYPT_KEY`
2. Copy `src/main/resources/application-local.example.yml` → `src/main/resources/application-local.yml` and fill in settings
3. Ensure MySQL (create `quickshare` db with utf8mb4) and Redis are running

## Testing & Milestone Gates

**WSL2 note:** Full `mvn test` may fail due to Mockito/ByteBuddy self-attach limitations. Default local strategy is compile + targeted tests + Docker smoke, not `mvn test` as sole gate.

**Small milestone default gate** (run in this order):

```bash
./scripts/check-js.sh                    # JS syntax check for all static JS
./mvnw -q -DskipTests compile            # Java compile
# targeted tests matching the change (see below)
docker compose up --build -d
./scripts/quickshare-smoke.sh            # API + flow smoke
```

**Smoke script variants:**
```bash
./scripts/quickshare-smoke.sh
SMOKE_UP=1 ./scripts/quickshare-smoke.sh
SMOKE_MODE=container SMOKE_DOCKER_CONTAINER=quickshare-app-1 ./scripts/quickshare-smoke.sh
```

**Playwright (browser automation):**
```bash
npm install && npx playwright install chromium
npx playwright test tests/e2e
npx playwright test tests/e2e/quickdrop.spec.js
npx playwright test tests/e2e/quickdrop-real.spec.js
EXPECT_QUICKDROP_FINAL_MODE=direct ./scripts/quickshare-playwright-smoke.sh
# Dockerized (no local Node/Chromium needed):
./scripts/quickshare-playwright-smoke.sh
PLAYWRIGHT_TEST_TARGET=tests/e2e/quickdrop.spec.js ./scripts/quickshare-playwright-smoke.sh
```

**Targeted test sets by change area:**

| Area | Test classes |
|------|-------------|
| File upload/download/quota | `FileControllerTest,FileServiceImplTest` |
| Payment & orders | `PlanControllerTest,PaymentServiceImplTest,AdminServiceImplTest` |
| Health & local storage | `LocalStorageRuntimeInspectorTest,AdminPolicyServiceImplTest,HealthControllerTest` |
| QuickDrop same-account | `QuickDropServiceImplTest` |
| QuickDrop pairing/direct | `QuickDropPairingServiceImplTest,QuickDropServiceImplTest` |
| Users | `UserServiceImplTest` |

**JS syntax check for individual files:**
```bash
node --check src/main/resources/static/js/<changed-file>.js
```

**Remote deploy (preprod):**
```bash
./scripts/deploy-preprod.sh
DEPLOY_GIT_BRANCH=main DEPLOY_RUN_SMOKE=1 DEPLOY_RUN_BROWSER_SMOKE=1 ./scripts/deploy-preprod.sh
```

## Architecture

### Layer Structure

```
controller/          → REST endpoints, extracts userId from JWT, returns Result<T>
service/             → Interfaces
service/impl/        → Business logic implementations
mapper/              → MyBatis Plus mappers (extend BaseMapper<Entity>)
entity/              → DB entities (@TableName, @TableLogic for soft delete)
dto/                 → Request payloads
vo/                  → Response value objects
config/              → Spring configuration classes
common/              → GlobalExceptionHandler, Result wrapper, UserRole enum
utils/               → JwtUtil
```

All responses use `Result<T>` wrapper `{ code, message, data }`. Global exception handling in `GlobalExceptionHandler` (`@RestControllerAdvice`).

### API Routes

- Public: `/api/auth/**`, `/api/public/**`, `/api/share`, `/api/download/**`, `/api/preview/**`, `/ws/quickdrop`
- Authenticated: `/api/files/**`, `/api/folders/**`, `/api/quickdrop/**`
- Admin: `/api/admin/**` (requires `ADMIN` role) + frontend at `/console/{ADMIN_CONSOLE_SLUG}`

### Security & Authentication

`JwtAuthenticationFilter` runs on every request, extracts the Bearer token from `Authorization` header or `?token=` query param, validates via `JwtUtil`, populates `SecurityContextHolder`. CSRF disabled; sessions stateless.

Special token types: guest-upload tokens (15-min TTL, `purpose="guest-upload"`). Passwords use `BCryptPasswordEncoder`.

### Storage Backend

`StorageService` interface abstracts all file I/O. `DelegatingStorageService` dispatches to:
- **Local**: files written to disk at `file.upload-dir`
- **S3-compatible**: AWS SDK v2, supports MinIO / Cloudflare R2

Backend is switchable at runtime from the admin console without restart.

**Upload deduplication**: MD5-based — identical content in the same folder returns the existing record; identical content elsewhere reuses the storage block.

### Database & Migrations

Schema managed by **Flyway** (`db/migration/V1__initial_schema.sql` through V10). Key tables:
- `user` — accounts, roles, quotas (`storageLimit`, `storageUsed`, `downloadLimit`, VIP expiry)
- `file_info` — file metadata + folder hierarchy (`isFolder`, `parentId`); soft-deleted via `@TableLogic`
- `share_link` — shareCode, extractCode, expiration, download count/limit
- `system_setting` — key/value runtime config (SMTP, storage type, policies, rate limits)
- `plan`, `payment_provider`, `payment_order` — subscription & payment
- `quickdrop_device`, `quickdrop_transfer`, `quickdrop_task`, `quickdrop_pair_task`, `quickdrop_public_share` — device transfer

### Runtime Configuration

`SystemSettingService` + `SystemSettingOverrideService` cache `system_setting` rows in memory with TTL. Admins can update SMTP, storage backends, email templates, and rate-limit policies live without restarting. Sensitive values are AES-encrypted via `SETTING_ENCRYPT_KEY`.

### QuickDrop (Device-to-Device Transfer)

WebSocket signaling endpoint: `ws://host/ws/quickdrop`

Flows: same-account direct (WebRTC via `quickdrop_task` + `direct-attempts` write-back), anonymous public pairing via pair codes (`quickdrop_pair_task`), server relay fallback, save-to-netdisk.

Key env vars: `QUICKDROP_DIRECT_TRANSFER_ENABLED`, `QUICKDROP_STUN_URLS`, `QUICKDROP_TURN_URLS`, `QUICKDROP_TURN_USERNAME`, `QUICKDROP_TURN_PASSWORD`.

### Frontend

Static HTML/JS/CSS served from `src/main/resources/static/`. No build step. JWT stored in `localStorage`; all API calls use `Authorization: Bearer <token>`. Language switching (`lang-switch.js`) and dark/light theme (`theme.js`) are runtime.

Key pages: `netdisk.html` (file manager), `quickdrop.html` (device transfer — mode-first UI with center pairing stage and secondary history page), `admin.html` (console), `pricing.html`.

### Key Environment Variables

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | HS256 signing key (required, ≥32 chars) |
| `SETTING_ENCRYPT_KEY` | AES key for encrypting DB-stored secrets |
| `ADMIN_CONSOLE_SLUG` | URL slug for admin console (default: `quickshare-admin`) |
| `BOOTSTRAP_ADMIN_ENABLED` | Auto-creates admin on first startup |
| `STORAGE_TYPE` | `local` or `s3` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | S3 storage config |
| `QUICKDROP_DIRECT_TRANSFER_ENABLED` | Enable WebRTC-based direct transfer |
| `QUICKDROP_STUN_URLS` / `QUICKDROP_TURN_URLS` | ICE servers for QuickDrop |

Full variable list: see `.env.example`.

## Delivery Checklist

Every milestone must:
1. Execute the matching verification commands (see Testing section above)
2. State which commands ran and what the results were
3. Sync `README.md`, `docs/STATUS.md`, `docs/PLAN.md`, `docs/CHANGELOG.md` if behavior changed
4. Add a `docs/archive/` record for significant changes
