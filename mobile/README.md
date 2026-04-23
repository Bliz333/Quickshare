# QuickShare Mobile App

This directory contains the in-repository QuickShare mobile client.

## Paths

- Expo / React Native entry: `App.tsx`
- App source: `src/`
- Native Android project: `android/`

## Current verified baseline

- guest Home and Share entry
- login-gated personal netdisk
- Google sign-in entry and registration flow
- file browsing, upload, preview, download, and share-link creation
- pickup lookup and save-to-netdisk
- same-account transfer sync with incoming/outgoing task visibility
- direct-session preparation with WebSocket signaling, peer-connection setup, and direct-transfer transport tests
- direct chunk protocol/storage tests plus incoming assembled-file save-to-netdisk path
- baseline UI rendering proof for guest home, signed-in dashboard, auth, files, share, pricing, and account surfaces
- baseline API-flow proof for auth, files, share creation, pickup, payment, transfer sync, relay/public-share upload, and save-to-netdisk
- Android debug and release build success for the current portrait/light-mode baseline
- emulator install, launch, and payment deep-link runtime validation for that baseline

## Common commands

```bash
npm run typecheck
npx expo start
npx expo run:android
cd android && ./gradlew assembleDebug
cd android && export NODE_BINARY=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node && ./gradlew --no-daemon assembleRelease
```

For broader testing and Android host/emulator workflow, see:

- `../docs/mobile/testing.md`
- `../docs/mobile/android.md`
