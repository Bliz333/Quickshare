# QuickShare Android Process

## Goal

This document describes the end-to-end Android workflow for the QuickShare Android client that now exists in this repository.

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

Current project decision already used by the Expo client:

- custom app scheme: `quicksharemobile://`
- payment return route: `quicksharemobile://payment-result`

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

## Local WSL + Windows Host Development

Current practical workflow for this repo:

- keep the source tree in WSL
- keep Android SDK / emulator / adb on the Windows host
- run Gradle from WSL against the generated `mobile/android` project
- run emulator and `adb.exe` from Windows

Recommended host-side layout used during validation:

- Android Studio: host GUI tool
- SDK root: `D:\Android\Sdk`
- AVD home: `D:\Android\Avd`
- Platform tools: `D:\Android\PlatformTools\platform-tools\adb.exe`

### Important environment notes

- Expo / Metro / Android release bundling currently require **Node 20** for this project.
- If the WSL system `node` is still 18, export `NODE_BINARY` explicitly before `assembleRelease`.

Example:

```bash
export NODE_BINARY=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node
cd mobile/android
./gradlew --no-daemon assembleRelease
```

### Example emulator commands (Windows)

```bat
cmd /c "set ANDROID_AVD_HOME=D:\Android\Avd && D:\Android\Sdk\emulator\emulator.exe -list-avds"
cmd /c "set ANDROID_AVD_HOME=D:\Android\Avd && D:\Android\Sdk\emulator\emulator.exe -avd QuickShareApi36 -gpu swiftshader_indirect"
D:\Android\PlatformTools\platform-tools\adb.exe devices
```

### Example install / launch commands (Windows)

After copying the APK from WSL to `D:\Android\app-release.apk`:

```bat
D:\Android\PlatformTools\platform-tools\adb.exe install -r D:\Android\app-release.apk
D:\Android\PlatformTools\platform-tools\adb.exe shell monkey -p com.anonymous.quicksharemobile -c android.intent.category.LAUNCHER 1
```

### Native verification evidence

The minimum useful native proof is not just “APK built”, but:

- emulator online in `adb devices`
- APK installed successfully
- `MainActivity` becomes the focused window
- `uiautomator dump` shows the real rendered app UI
- external payment return can reopen the app through `quicksharemobile://payment-result?orderNo=...`

Useful manual command:

```bat
D:\Android\PlatformTools\platform-tools\adb.exe shell am start -W -a android.intent.action.VIEW -d "quicksharemobile://payment-result?orderNo=QS_TEST_DEEPLINK"
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
