# QuickShare iOS Process

## Goal

This document describes the end-to-end iOS workflow for the generated QuickShare iOS project that now exists in the repository, while also documenting the remaining Apple-side runtime and release hardening work.

## Current repository-verified baseline

- `mobile/ios/` exists in the tracked repository
- Expo prebuild for iOS succeeds from the tracked Expo app
- CI regenerates the iOS project from the current Expo configuration
- `scripts/quickshare-ios-readiness.sh` validates the tracked iOS project structure, bundle identifier, linking hooks, and Expo pod wiring
- `scripts/quickshare-ios-simulator-smoke.sh` performs `pod install`, simulator `xcodebuild`, app installation, app launch, and screenshot capture for the generated project
- CI runs that simulator smoke script on macOS and uploads the screenshot artifact as launch proof

The remaining gap is physical iPhone validation and distribution hardening beyond the simulator path, which require Apple tooling and cannot be completed from the current Linux execution environment. Those are release-operation tasks beyond the tracked repository baseline, not evidence that the repository lacks an iOS client implementation.

## Toolchain Baseline

- macOS
- Xcode (current stable)
- Apple Developer Program membership
- simulator + physical iPhone testing

## Required Apple Assets

- Apple Developer account
- App ID / bundle ID
- certificates
- provisioning profiles
- App Store Connect access

## Standard Build Variants

- Debug
- Release

## Signing and Provisioning

You must manage:

- development certificate
- distribution certificate
- development provisioning profile
- App Store provisioning profile

Rules:

- never commit certificates or profiles
- keep them in secure storage
- document renewal dates

## iOS Release Flow

1. bump app version/build number
2. verify backend compatibility
3. run automated tests
4. run simulator tests
5. run physical-device tests
6. archive release build
7. upload to TestFlight
8. validate internal/external testing
9. submit to App Store review

## Suggested Build Commands

Example only — depends on final iOS project structure:

```bash
xcodebuild -scheme QuickShare -configuration Debug build
xcodebuild -scheme QuickShare -configuration Release archive
```

## iOS Testing Checklist

- repository readiness script passes
- simulator smoke script passes and produces a launch screenshot
- login/logout
- upload/download/share-link flows
- pickup link flow
- file preview / share sheet behavior
- app reopen after backgrounding
- reconnect behavior after network loss

## App Store Connect Workflow

Typical path:

- internal TestFlight
- optional external TestFlight
- production release

## iOS-specific Production Concerns

- ATS / HTTPS requirements
- file/document picker behavior
- background upload limitations
- notification permission UX
- review sensitivity around minimal-wrapper apps

## Required Production Dependencies

The iOS client depends on:

- valid HTTPS on the production domain (for example `quickshare.example.com`)
- stable API compatibility
- production-grade file storage
- good failure handling for reconnect and uploads

If native direct transfer is added later, additional iOS-specific transport validation will be required.
