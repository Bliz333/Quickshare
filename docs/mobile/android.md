# QuickShare Android Process

## Goal

This document describes the end-to-end Android workflow for QuickShare once the Android client exists.

## Toolchain Baseline

- Android Studio (current stable)
- JDK 17
- Android SDK / emulator images
- Gradle wrapper inside the Android app repo/module

## Standard Build Variants

- `debug` — local development and QA
- `release` — signed production build

## Required Android Decisions

Before implementation begins, define:

- application ID / package name
- min SDK
- target SDK
- versioning strategy
- environment handling (`dev`, `staging`, `prod`)
- API base URL selection strategy

## Signing Process

You will need a release keystore.

Minimum signing assets:

- release keystore file
- keystore password
- key alias
- key password

Rules:

- never commit keystores
- store them in a secure password manager / secret vault
- keep backup copies offline

## Android Release Flow

1. bump app version
2. verify backend compatibility
3. run automated tests
4. run physical-device smoke tests
5. build signed release bundle
6. upload to internal testing
7. validate on Play testing track
8. publish staged rollout

## Suggested Commands

Example only — depends on final Android project structure:

```bash
./gradlew test
./gradlew assembleDebug
./gradlew bundleRelease
```

## Android Testing Checklist

- login works against production-like backend
- file upload works on Wi-Fi and mobile data
- file download works for large files
- share-link creation works
- pickup flow works
- app survives background/foreground transitions
- push or reconnect behavior is acceptable

## Play Console Workflow

Recommended tracks:

- Internal testing
- Closed testing
- Production

Suggested rollout strategy:

- 10%
- 25%
- 50%
- 100%

## Android-specific Production Concerns

- file permission handling
- media picker/document picker UX
- app lifecycle under bad networks
- upload resume strategy
- crash reporting
- ANR monitoring

## Required Production Dependencies

The Android client depends on the backend being production-ready:

- HTTPS
- stable API base URL
- health checks
- storage reliability
- WebSocket support if same-account live discovery is used
- TURN/STUN only if mobile direct transfer is actually implemented
