#!/usr/bin/env bash
# Builds signed APKs and publishes them as a GitHub release.
#
#   scripts/release.sh 1.20.0 "یادداشت کوتاه این نسخه"
#
# Sets the version in build.gradle and src/app/config/version.ts, commits that, builds,
# then uploads Polt-arm64.apk, Polt-armv7.apk and update.json. The asset names never
# change, so .../releases/latest/download/Polt-arm64.apk always points at the newest build
# (the QR code) and .../releases/latest/download/update.json feeds the in-app update check.
set -euo pipefail

VERSION="${1:?usage: scripts/release.sh <version> [notes]}"
NOTES="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$ROOT/android/app/build.gradle"
OUT="$ROOT/release/$VERSION"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Commit or stash your changes first." >&2; exit 1; }
grep -q "UPDATE_MANIFEST_URL=https://" .env || { echo "Set UPDATE_MANIFEST_URL in .env first." >&2; exit 1; }

CODE=$(( $(sed -n 's/.*versionCode \([0-9]*\).*/\1/p' "$GRADLE") + 1 ))
sed -i '' "s/versionCode [0-9]*/versionCode $CODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$GRADLE"
sed -i '' "s/APP_VERSION = '[^']*'/APP_VERSION = '$VERSION'/" src/app/config/version.ts
git commit -q -m "Release $VERSION" -- "$GRADLE" src/app/config/version.ts

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
(cd android && ./gradlew assembleRelease -q)

mkdir -p "$OUT"
APKS="$ROOT/android/app/build/outputs/apk/release"
cp "$APKS/app-arm64-v8a-release.apk" "$OUT/Polt-arm64.apk"
cp "$APKS/app-armeabi-v7a-release.apk" "$OUT/Polt-armv7.apk"
NOTES="$NOTES" VERSION="$VERSION" URL="https://github.com/$REPO/releases/latest" \
  node -e 'const n=process.env.NOTES; process.stdout.write(JSON.stringify({versionName:process.env.VERSION,url:process.env.URL,...(n?{notes:n}:{})}))' \
  > "$OUT/update.json"

git push -q origin HEAD
gh release create "v$VERSION" "$OUT/Polt-arm64.apk" "$OUT/Polt-armv7.apk" "$OUT/update.json" \
  --title "پولت $VERSION" --notes "${NOTES:-نسخهٔ $VERSION}" --latest
echo "https://github.com/$REPO/releases/latest/download/Polt-arm64.apk"
