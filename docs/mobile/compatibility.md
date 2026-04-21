# QuickShare Mobile Compatibility Evidence

## Goal

This document maps the current repository-visible compatibility evidence for the QuickShare mobile client.

## Repository-verified evidence

### Android

- source app: `mobile/`
- generated native project: `mobile/android/`
- unit tests + typecheck: `mobile/package.json`, `mobile/src/lib/*.test.ts`
- native build: `mobile/android/gradlew assembleDebug`
- runtime evidence path: `docs/mobile/testing.md`
- deep-link/runtime wiring: `mobile/app.json`, `mobile/android/app/src/main/AndroidManifest.xml`

### iOS

- generated native project: `mobile/ios/`
- structure/wiring check: `scripts/quickshare-ios-readiness.sh`
- simulator smoke: `scripts/quickshare-ios-simulator-smoke.sh`
- CI job: `.github/workflows/ci.yml` → `ios-build`
- simulator artifact path: `mobile/ios/build/ios-simulator-launch.png`

### Web compatibility baseline

- browser matrix in CI: `.github/workflows/ci.yml` → `playwright-mock` on `chromium`, `firefox`, `webkit`
- smoke entrypoint: `scripts/quickshare-playwright-smoke.sh`
- real transfer regression: `tests/e2e/quickdrop-real.spec.js`
- page-level coverage examples:
  - `tests/e2e/home-notifications.spec.js`
  - `tests/e2e/pricing-payment.spec.js`
  - `tests/e2e/register-captcha.spec.js`
  - `tests/e2e/netdisk-*.spec.js`

## What this repository proves today

- the mobile client is implemented in the tracked repository
- Android has code, tests, native build validation, emulator/runtime evidence, and payment deep-link proof
- iOS has a tracked native project, readiness checks, and a CI-backed simulator build/install/launch proof path
- web compatibility is covered by repo smoke plus Playwright browser-matrix validation

## What still depends on external release infrastructure

- physical iPhone validation
- Apple signing / archive / TestFlight / App Store submission
- broader release-operations ownership outside the Linux execution environment

Those items are release/distribution hardening tasks, not missing repository implementation.
