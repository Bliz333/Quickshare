#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT_DIR/mobile/ios"
PBXPROJ="$IOS_DIR/QuickShareMobile.xcodeproj/project.pbxproj"
APP_DELEGATE="$IOS_DIR/QuickShareMobile/AppDelegate.swift"
PODFILE="$IOS_DIR/Podfile"

if [[ ! -d "$IOS_DIR" ]]; then
  echo "[ios-readiness] missing mobile/ios directory" >&2
  exit 1
fi

if [[ ! -f "$PBXPROJ" ]]; then
  echo "[ios-readiness] missing Xcode project.pbxproj" >&2
  exit 1
fi

if [[ ! -f "$APP_DELEGATE" ]]; then
  echo "[ios-readiness] missing AppDelegate.swift" >&2
  exit 1
fi

if [[ ! -f "$PODFILE" ]]; then
  echo "[ios-readiness] missing Podfile" >&2
  exit 1
fi

grep -q 'PRODUCT_BUNDLE_IDENTIFIER = "com.anonymous.quicksharemobile";' "$PBXPROJ" || {
  echo "[ios-readiness] bundle identifier not found in project.pbxproj" >&2
  exit 1
}

grep -q 'RCTLinkingManager.application' "$APP_DELEGATE" || {
  echo "[ios-readiness] linking hooks missing in AppDelegate.swift" >&2
  exit 1
}

grep -q 'use_expo_modules!' "$PODFILE" || {
  echo "[ios-readiness] Expo modules integration missing in Podfile" >&2
  exit 1
}

echo "[ios-readiness] tracked iOS project structure looks consistent"
