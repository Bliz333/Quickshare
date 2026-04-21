# QuickShare Mobile Docs

This directory collects the planning and operational documents for the QuickShare mobile client and its release process.

## Current Reality

QuickShare is currently a **web product with an in-repository mobile client and generated native projects**:

- Spring Boot backend
- static HTML / JS frontend
- Docker Compose deployment
- web-side preview/readability prerequisites are now complete (inline preview, embedded viewer mode, fallback cleanup)
- Expo / React Native mobile app under `mobile/`
- generated native Android project under `mobile/android/`
- generated native iOS project under `mobile/ios/`
- no store publishing pipeline yet

These docs describe the current implemented mobile baseline in the tracked repository, plus the separate operational guides used when preparing Android and iOS store releases.

## Current Implemented Mobile Baseline

The repository now contains a working mobile client baseline with these verified capabilities:

- guest-accessible Home and Share flows
- login-gated personal netdisk access
- username/password login and Google sign-in entry
- registration flow and verification-code sending
- file browsing, folder operations, upload, preview, download, and share-link creation
- transfer pickup lookup, preview, download, and save-to-netdisk
- same-account transfer sync with incoming/outgoing task visibility
- incoming relay transfer download/save actions
- direct-transfer baseline including signaling, packet protocol, local persistence, and backend attempt sync
- plan list, order list, in-app payment return handling, and pending-order polling
- Android debug and release builds, emulator install, launch, and deep-link runtime validation
- generated native iOS project, repo-level readiness checks, and CI-validated simulator build/install/launch proof

Store-release operations remain documented separately in `android.md`, `ios.md`, `store-submission.md`, and `testing.md`.

## Current compatibility evidence

What the tracked repository currently proves directly:

- Android: typecheck, unit tests, native debug/release build, emulator launch, deep-link handling
- iOS: generated native project exists in `mobile/ios/`, is regenerated in CI from the Expo app config, passes `scripts/quickshare-ios-readiness.sh`, and has a macOS CI simulator build/install/launch + screenshot artifact path through `scripts/quickshare-ios-simulator-smoke.sh`

What still requires Apple tooling outside this Linux environment:

- physical iPhone validation
- signing / archive / TestFlight readiness

Those remaining items are Apple-runtime and distribution hardening work, not evidence that the tracked repository lacks an iOS client implementation.

For a compact evidence map, see [compatibility.md](compatibility.md).

## Read This First

1. [architecture.md](architecture.md) — choose the mobile route first
2. [testing.md](testing.md) — understand how mobile quality should be verified
3. [android.md](android.md) — Android build, signing, release flow
4. [ios.md](ios.md) — iOS build, signing, release flow
5. [store-submission.md](store-submission.md) — Google Play + App Store submission checklist
6. [responsibilities.md](responsibilities.md) — ownership and operational responsibilities
7. [../ops/production-deployment.md](../ops/production-deployment.md) — production backend/server checklist

## Recommended Reading Order by Goal

### If you are deciding how far to take mobile

1. [architecture.md](architecture.md)
2. [responsibilities.md](responsibilities.md)
3. [testing.md](testing.md)

### If you want to ship an Android app first

1. [architecture.md](architecture.md)
2. [android.md](android.md)
3. [store-submission.md](store-submission.md)
4. [testing.md](testing.md)

### If you want to ship iOS

1. [architecture.md](architecture.md)
2. [ios.md](ios.md)
3. [store-submission.md](store-submission.md)
4. [testing.md](testing.md)

## Scope Boundaries

These docs cover:

- architecture choices
- build and signing workflows
- store submission checklists
- mobile testing expectations
- production backend requirements for mobile

These docs describe the mobile client that already exists in this repository, the compatibility evidence already tracked here, and the separate operational guides used for broader release confidence.

## Working Principle

For QuickShare, the backend is already a strong foundation for mobile. The main product choice is no longer whether mobile is possible, but how far the existing client should be pushed toward store-grade release quality.

The April 2026 web preview/readability work verified that image, PDF, Office, and text previews now behave correctly in the browser, including fallback handling and mobile-sized receive surfaces. That work removed the main web-side blocker before the current tracked mobile implementation was added.
