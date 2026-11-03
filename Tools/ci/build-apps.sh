#!/bin/bash
# Builds TypeWrite the way CI checks it: for the iPhone Simulator and for the Mac (Mac Catalyst),
# without signing. Run from anywhere on a Mac with Xcode 16 or later.
set -euo pipefail
cd "$(dirname "$0")/../.."

build() {   # $1 = what, $2 = xcodebuild destination
  echo "::group::Build for $1"
  xcodebuild -project TypeWrite.xcodeproj -scheme TypeWrite -configuration Debug \
    -destination "$2" -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -n 60
  echo "::endgroup::"
}

build "the iPhone Simulator" "generic/platform=iOS Simulator"
build "the Mac" "generic/platform=macOS,variant=Mac Catalyst"
