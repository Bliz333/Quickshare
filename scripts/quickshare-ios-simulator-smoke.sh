#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[ios-sim-smoke] macOS is required" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="${IOS_DIR:-$ROOT_DIR/mobile/ios}"
SCHEME="${IOS_SCHEME:-QuickShareMobile}"
WORKSPACE="${IOS_WORKSPACE:-QuickShareMobile.xcworkspace}"
CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
SIMULATOR_NAME="${IOS_SIMULATOR_NAME:-iPhone 15}"
DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-$IOS_DIR/build/ios-derived}"
APP_BUNDLE_ID="${IOS_APP_BUNDLE_ID:-com.anonymous.quicksharemobile}"
SCREENSHOT_PATH="${IOS_SCREENSHOT_PATH:-$IOS_DIR/build/ios-simulator-launch.png}"
APP_PATH="$DERIVED_DATA_PATH/Build/Products/${CONFIGURATION}-iphonesimulator/${SCHEME}.app"

if [[ ! -d "$IOS_DIR" ]]; then
  echo "[ios-sim-smoke] missing iOS directory: $IOS_DIR" >&2
  exit 1
fi

if [[ ! -f "$IOS_DIR/Podfile" ]]; then
  echo "[ios-sim-smoke] missing Podfile in $IOS_DIR" >&2
  exit 1
fi

rm -rf "$DERIVED_DATA_PATH"
mkdir -p "$(dirname "$SCREENSHOT_PATH")"

pushd "$IOS_DIR" >/dev/null
trap 'popd >/dev/null' EXIT

echo "[ios-sim-smoke] pod install"
pod install

echo "[ios-sim-smoke] xcodebuild simulator app"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build

if [[ ! -d "$APP_PATH" ]]; then
  echo "[ios-sim-smoke] built app not found at $APP_PATH" >&2
  exit 1
fi

echo "[ios-sim-smoke] boot simulator"
xcrun simctl boot "$SIMULATOR_NAME" || true
xcrun simctl bootstatus booted -b

echo "[ios-sim-smoke] install app"
xcrun simctl install booted "$APP_PATH"

APP_CONTAINER="$(xcrun simctl get_app_container booted "$APP_BUNDLE_ID" app)"
if [[ -z "$APP_CONTAINER" || ! -d "$APP_CONTAINER" ]]; then
  echo "[ios-sim-smoke] simulator app container not found for $APP_BUNDLE_ID" >&2
  exit 1
fi

echo "[ios-sim-smoke] launch app"
LAUNCH_OUTPUT="$(xcrun simctl launch booted "$APP_BUNDLE_ID")"
echo "$LAUNCH_OUTPUT"

echo "[ios-sim-smoke] capture screenshot"
xcrun simctl io booted screenshot "$SCREENSHOT_PATH"

if [[ ! -f "$SCREENSHOT_PATH" ]]; then
  echo "[ios-sim-smoke] screenshot not created at $SCREENSHOT_PATH" >&2
  exit 1
fi

echo "[ios-sim-smoke] simulator launch proof saved to $SCREENSHOT_PATH"

trap - EXIT
popd >/dev/null
