# QuickShare Mobile Testing Strategy

## Goal

Mobile testing must prove more than web correctness. It must also prove:

- device lifecycle resilience
- upload/download reliability
- session recovery
- store-release confidence

## Test Layers

### 1. API compatibility testing

Validate that the mobile client works against the real backend contract:

- auth
- netdisk listing
- upload
- download
- share creation
- pickup

### 2. UI / integration testing

Validate real app behavior:

- login flow
- navigation
- upload progress
- download state
- share-link creation and copy/share actions

Current tracked mobile baseline notes:

- the app is currently configured as a portrait-first, light-mode baseline in `mobile/app.json`
- broader device/theme permutations belong to later expansion or external release validation, not to the current repository baseline claim

### 3. Manual device testing for external store-release confidence

For future store distribution or external release confidence, test on:

- at least one physical Android phone
- at least one physical iPhone
- at least one narrow-screen device
- at least one larger-screen device

Repository-level proof that already exists today:

- `scripts/quickshare-ios-readiness.sh` checks the tracked iOS project structure and linking wiring
- `scripts/quickshare-ios-simulator-smoke.sh` builds, installs, launches, and screenshots the iOS simulator app on macOS CI
- Android validation includes native build, emulator launch, and payment deep-link reopening evidence
- `mobile/src/components/mobileBaseline.test.tsx` covers the current baseline UI surfaces
- `mobile/src/lib/apiBaseline.test.ts` covers the current baseline API-backed app flows

## Core Mobile Regression Checklist

- login / logout
- invalid token recovery
- upload large file
- download shared file
- save shared file to personal storage
- open app from cold start
- return from background
- network loss and reconnect
- language switch if supported
- theme permutations only if supported by the current app configuration

## External Store Release Gate Suggestion

If preparing a future store release outside this repository, do not release unless all of the following pass:

- automated unit/integration checks
- manual physical-device smoke tests
- production backend health check
- API compatibility confirmation
- release notes completed

For QuickShare specifically, repository acceptance and release acceptance are different bars:

- repository acceptance = tracked code, tests, native projects, and CI-backed simulator/emulator validation are present and passing
- release acceptance = physical-device coverage, signing, distribution, and release operations are complete

The second bar is intentionally stricter, but it should not be used to erase the first bar when evaluating whether the repository already contains a real implemented mobile client with repository-visible compatibility evidence.

## Recommended Monitoring After Release

- crash reporting
- upload failure rate
- download failure rate
- authentication failure rate
- reconnect failure patterns

## QuickShare-specific Testing Advice

For the first mobile release, do not over-scope tests around full QuickDrop parity unless that feature is truly in scope and you are targeting store-grade release readiness.

The most important early tests are:

- account auth
- file handling
- share-link creation
- pickup/download
- storage interactions

## Local Android Testing Workflow (WSL + Windows Host)

This repository is currently developed from WSL, but the Android emulator and GUI tools run on the Windows host.

### Recommended local setup

- Keep the repo in WSL
- Run backend and Gradle commands from WSL
- Run Android Studio / emulator / Windows adb on the host
- Use a Windows-side SDK root such as `D:\Android\Sdk`
- Use a Windows-side AVD home such as `D:\Android\Avd`

### Backend bring-up

From WSL repo root:

```bash
docker compose up --build -d --remove-orphans
curl http://127.0.0.1:8080/api/health
```

Expected result: `status=UP`, database `UP`, redis `UP`.

### Expo / web validation

When Expo CLI needs Node 20, do not rely on the system `node` from WSL if it is still Node 18.

```bash
/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node ./node_modules/expo/bin/cli start --web --port 19007
```

This is useful for page-level QA, but it is **not** enough to replace native Android validation.

### Android native build from WSL

Generate Android project (once):

```bash
npx -y node@20 ./node_modules/expo/bin/cli prebuild --platform android --no-install
```

Build debug APK:

```bash
cd mobile/android
./gradlew assembleDebug
```

Build release APK with explicit Node 20 for JS bundle generation:

```bash
cd mobile/android
export NODE_BINARY=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node
./gradlew --no-daemon assembleRelease
```

### Windows host Android SDK / emulator expectations

The working layout used in this project was:

- SDK root: `D:\Android\Sdk`
- Platform Tools: `D:\Android\PlatformTools\platform-tools\adb.exe`
- AVD home: `D:\Android\Avd`
- Emulator name: `QuickShareApi36`

Typical Windows-side commands:

```bat
cmd /c "set ANDROID_AVD_HOME=D:\Android\Avd && D:\Android\Sdk\emulator\emulator.exe -list-avds"
cmd /c "set ANDROID_AVD_HOME=D:\Android\Avd && D:\Android\Sdk\emulator\emulator.exe -avd QuickShareApi36 -gpu swiftshader_indirect"
```

Confirm device is online:

```bat
D:\Android\PlatformTools\platform-tools\adb.exe devices
```

Expected result: `emulator-5554    device`

### Install and launch the app on emulator

Copy the built APK to the Windows drive first (from WSL):

```bash
cp mobile/android/app/build/outputs/apk/release/app-release.apk /mnt/d/Android/app-release.apk
```

Install and launch (Windows host):

```bat
D:\Android\PlatformTools\platform-tools\adb.exe install -r D:\Android\app-release.apk
D:\Android\PlatformTools\platform-tools\adb.exe shell monkey -p com.anonymous.quicksharemobile -c android.intent.category.LAUNCHER 1
```

### Native runtime verification

Confirm the app is really in foreground:

```bat
D:\Android\PlatformTools\platform-tools\adb.exe shell dumpsys window
```

Look for:

- `mCurrentFocus=... com.anonymous.quicksharemobile/.MainActivity`
- `mFocusedApp=... com.anonymous.quicksharemobile/.MainActivity`

Dump visible UI for evidence:

```bat
D:\Android\PlatformTools\platform-tools\adb.exe shell uiautomator dump /sdcard/window_dump.xml
D:\Android\PlatformTools\platform-tools\adb.exe pull /sdcard/window_dump.xml D:\Android\window_dump.xml
```

### Payment return deep-link verification

After installing the current APK, verify that Android can reopen the app from the payment return scheme:

```bat
D:\Android\PlatformTools\platform-tools\adb.exe shell am start -W -a android.intent.action.VIEW -d "quicksharemobile://payment-result?orderNo=QS_TEST_DEEPLINK"
D:\Android\PlatformTools\platform-tools\adb.exe shell dumpsys window
```

Expected result:

- `Status: ok`
- `Activity: com.anonymous.quicksharemobile/.MainActivity`
- `mCurrentFocus=... com.anonymous.quicksharemobile/.MainActivity`
- `mFocusedApp=... com.anonymous.quicksharemobile/.MainActivity`

### Current project-specific acceptance checks

The following behaviors were explicitly verified and should remain part of regression checks:

- guest can enter Home directly
- Home shows a direct share entry
- Share Center is reachable without login
- Files tab redirects/gates into sign-in when unauthenticated
- Google sign-in entry is visible when `googleClientId` is configured
- payment creation opens the external provider and returns into the app through `quicksharemobile://payment-result`
- pending payment orders can be refreshed in-app and auto-poll until they leave `pending`
- transfer sync preserves a stable mobile device identity instead of using one hardcoded device ID
- Home shows both incoming and outgoing same-account transfer tasks after sync
- incoming relay tasks can expose in-app `Download` and `Save` actions when the relay transfer is ready
- incoming relay task actions should still resolve when sync returns relay session data more fully than nested task attempts
- same-account direct-session preparation can fetch RTC config, create the direct session, and surface local direct transport state in the Home tab
- incoming direct chunks can be persisted locally, assembled, and promoted into a save-to-netdisk action from the mobile UI
- app installs and launches into `MainActivity` on the Android emulator

### Common failure modes

- **Metro / Expo on Node 18** → `configs.toReversed is not a function`
  - fix by using Node 20 explicitly for Expo / Android release bundling
- **Emulator cannot find AVD**
  - launch with `ANDROID_AVD_HOME=D:\Android\Avd`
- **Android Studio write-permission warnings when opened from `\\wsl$`**
  - prefer keeping SDK/AVD on Windows and using WSL only for repo/build commands
- **Debug build redbox: Unable to load script**
  - expected when Metro/reverse is not configured; use release APK for stable native smoke
