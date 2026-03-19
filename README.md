# QuickShare

<div align="center">

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://adoptium.net/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A modern file sharing and storage system with admin console, S3-compatible storage, and Office document preview.

</div>

## Features

- **File Sharing** — Upload files, generate share links with extraction codes, expiration, and download limits
- **Folder Organization** — Nested folder hierarchy with drag-and-drop upload
- **Guest Upload** — Anonymous users can upload and share files without registration
- **Office Preview** — Word/Excel/PowerPoint documents converted to PDF via LibreOffice, viewed in built-in PDF.js viewer
- **Admin Console** — Hidden-path admin panel for managing users, files, shares, and all system policies
- **Storage Backends** — Local filesystem or S3-compatible storage (AWS S3, MinIO, Cloudflare R2), switchable from admin panel
- **Email System** — SMTP configuration, multi-locale email templates, admin announcement emails
- **Security** — JWT auth, role-based access (USER/ADMIN), rate limiting, reCAPTCHA, AES-encrypted sensitive settings
- **Multi-language** — English and Chinese UI with runtime switching
- **Dark/Light Theme** — Responsive design with theme toggle

## Quick Start

### Docker Compose (Recommended)

```bash
cp .env.example .env
# Edit .env: change JWT_SECRET, BOOTSTRAP_ADMIN_PASSWORD, SETTING_ENCRYPT_KEY

docker compose up --build -d
# Open http://localhost:8080
# Admin: http://localhost:8080/console/quickshare-admin (admin / ChangeMeAdmin123!)
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

# Run tests
mvn test
```

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

Storage, SMTP, email templates, rate limits, CORS, upload/preview policies, and registration settings can all be changed at runtime from the admin console.

## Admin Console

Access at `/console/{ADMIN_CONSOLE_SLUG}` (default: `/console/quickshare-admin`).

Capabilities:
- **Users** — List, create, delete, change roles
- **Files & Shares** — Browse all files, force-delete, disable share links
- **Storage** — Switch between local and S3 storage, test connection
- **SMTP** — Configure mail server, send test email
- **Email Templates** — Edit verification code email per language
- **Announcements** — Send email to all or selected users
- **Policies** — Rate limits, CORS, upload limits, preview settings, registration controls
- **Console Access** — Change the hidden admin URL slug

## API Overview

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/register` | No | Register with email verification |
| `POST /api/auth/login` | No | Login, returns JWT token |
| `POST /api/upload` | Optional | Upload file (guest or authenticated) |
| `POST /api/share` | Optional | Create share link |
| `GET /api/share/{code}` | No | Get share info |
| `GET /api/download/{code}` | No | Download shared file |
| `GET /api/preview/{code}` | No | Preview shared file (PDF/Office/image/text) |
| `GET /api/files` | Yes | List user's files |
| `GET /api/files/{id}/preview` | Yes | Preview own file |
| `GET /api/files/{id}/download` | Yes | Download own file |
| `POST /api/folders` | Yes | Create folder |
| `GET /api/health` | No | Health check (DB, Redis, Storage status) |
| `GET /api/admin/*` | Admin | Admin management endpoints |

## Database

Schema managed by Flyway. Initial migration: `src/main/resources/db/migration/V1__initial_schema.sql`.

Tables: `user`, `file_info`, `share_link`, `system_setting`, `flyway_schema_history`.

For existing databases, Flyway baselines automatically (`baseline-on-migrate: true`).

## License

[MIT License](LICENSE)
