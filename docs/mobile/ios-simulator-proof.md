# QuickShare iOS Simulator Proof

## Provenance

- GitHub Actions run: `24739079602`
- job: `ios-build` (`72373988198`)
- branch: `feature/ios-proof-20260421`
- commit: `71253e78eb3be5a2a5f1e72a42365d7df8d84f57`
- artifact: `ios-simulator-proof` (`6562347779`)
- artifact digest: `sha256:d288100eb9a5b76b68c92d1c54e84d31a6b5f80deeb8799ffe7326d31b9048e3`
- generated at: `2026-04-21T18:33:11Z`

## Repository-visible proof file

- screenshot: `mobile/ios/build/ios-simulator-launch.png`

## What this proves

- the tracked iOS project was regenerated from the Expo app config on macOS CI
- CocoaPods integration completed successfully for the generated iOS project
- the simulator build completed successfully
- the app was installed and launched in the iOS simulator
- the launch screenshot was pulled back into the repository as a visible proof artifact

## Visual result

- the screenshot shows the QuickShare mobile app launch UI rather than the earlier redbox / missing-bundle error state

## Related files

- `.github/workflows/ci.yml`
- `scripts/quickshare-ios-simulator-smoke.sh`
- `docs/mobile/ios.md`
- `docs/mobile/compatibility.md`
