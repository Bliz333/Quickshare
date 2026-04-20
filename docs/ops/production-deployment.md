# Production Deployment Guide

## Purpose

This guide is the practical first-time production deployment runbook for QuickShare.

It is meant for a real public host using:

- Docker Compose
- nginx on the host
- Certbot on the host
- a public domain such as `quickshare.example.com`

## Recommended Production Shape

- QuickShare app stack runs with Docker Compose
- nginx terminates HTTPS on the host
- Certbot manages certificates on the host
- app remains on port 8080 behind nginx
- MySQL and Redis remain local to the host unless intentionally externalized

## Before You Start

Prepare these items first:

- domain already points to the server IP
- SSH access confirmed
- host has Docker and Docker Compose
- ports 80 and 443 open
- enough disk for images, uploads, and MySQL data
- production `.env` values prepared

## Minimum Production Checklist

### 1. System packages

Install at least:

- git
- curl
- docker
- docker compose
- nginx
- certbot
- python3-certbot-nginx

### 2. Application checkout

Use a real git working copy on the server:

```bash
git clone <repo-url> /opt/quickshare
cd /opt/quickshare
```

### 3. Production environment file

Create `/opt/quickshare/.env` from `.env.example` and set at minimum:

- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `SETTING_ENCRYPT_KEY`
- any SMTP or storage variables you actually use

For production:

- keep `BOOTSTRAP_ADMIN_ENABLED=false` after first setup unless intentionally needed
- prefer strong random secrets
- consider `STORAGE_TYPE=s3` if long-term production storage needs exceed single-host comfort

### 4. Start the stack

```bash
cd /opt/quickshare
docker compose up --build -d
```

### 5. Health verification

```bash
curl -fsS http://127.0.0.1:8080/api/health
```

Expected:

- app `UP`
- database `UP`
- redis `UP`

## nginx + Certbot

Use host nginx in front of QuickShare.

### HTTP bootstrap

Create an nginx server block for `quickshare.example.com` and `www.quickshare.example.com` (if used) that proxies to `127.0.0.1:8080`.

Important:

- forward standard proxy headers
- allow WebSocket upgrade for transfer signaling
- set `client_max_body_size` high enough for uploads

See [https-proxy.md](https-proxy.md) for the reusable baseline.

### TLS issuance

Once nginx is serving port 80 correctly:

```bash
certbot --nginx -d quickshare.example.com
```

If `www.quickshare.example.com` is also configured, include it explicitly.

### Renewal

Verify:

```bash
systemctl status certbot.timer
```

## Post-Deploy Verification

Run after the first production deploy:

```bash
curl -fsS https://quickshare.example.com/api/health
./scripts/check-js.sh
./scripts/quickshare-smoke.sh
```

Then verify manually:

- homepage loads
- login works
- netdisk opens
- share-link creation works
- pickup link works
- WebSocket-backed transfer status works through nginx

## Reverse Proxy Notes

Production nginx must support:

- standard HTTP proxying
- WebSocket upgrade
- long upload/download timeouts
- TLS certificate reloads

## Data and Backup

At minimum, plan backups for:

- MySQL
- uploaded files / storage backend
- `.env` and operational configuration

If using local storage, you must also monitor disk growth aggressively.

## Monitoring

Production should have:

- health endpoint monitoring
- disk monitoring
- Docker/container restart visibility
- backup success checks

## Production vs Pre-production

This file is the first-time deployment runbook.

For ongoing difference tracking between test and production environments, also read:

- [prod-preprod.md](prod-preprod.md)
- [https-proxy.md](https-proxy.md)

## Current Blocking Inputs for a Live Deployment

To perform a real production deployment from an automation session, the following must be known and valid:

- server host/IP
- SSH username
- authentication method (password or key)
- final domain
- whether the server already has Docker/nginx/certbot installed
- whether `.env` should be created fresh or copied from an existing secure source

Without those, deployment preparation can be documented, but the actual production rollout cannot be completed safely.
