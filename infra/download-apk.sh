#!/usr/bin/env bash
# Downloads the Android APK from GitHub Releases and stores it locally for serving.
# Usage:
#   ./infra/download-apk.sh [prod|test]
#
# The APK is placed in a Docker volume that Caddy serves at /downloads/

set -euo pipefail

ENV="${1:-prod}"
REPO="bah13-a/damscino"

case "$ENV" in
  prod)
    RELEASE_TAG="android-prod"
    APK_FILE="damascino-privileges.apk"
    ;;
  test)
    RELEASE_TAG="android-test"
    APK_FILE="damascino-privileges-test.apk"
    ;;
  *)
    echo "Usage: $0 [prod|test]"
    exit 1
    ;;
esac

echo "⬇ Downloading $APK_FILE from GitHub Releases..."

# Get the download URL from the latest release
RELEASE_URL="https://api.github.com/repos/$REPO/releases/tags/$RELEASE_TAG"
DOWNLOAD_URL=$(curl -s "$RELEASE_URL" | grep -o "browser_download_url.*$APK_FILE" | cut -d'"' -f3)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "❌ Could not find $APK_FILE in release $RELEASE_TAG"
  echo "   Make sure the GitHub Actions workflow has built and released the APK."
  echo "   Release URL: https://github.com/$REPO/releases/tag/$RELEASE_TAG"
  exit 1
fi

echo "   URL: $DOWNLOAD_URL"

# Create downloads directory if it doesn't exist
mkdir -p app-downloads

# Download the APK
curl -fL -o "app-downloads/$APK_FILE" "$DOWNLOAD_URL"

if [ -f "app-downloads/$APK_FILE" ]; then
  SIZE=$(du -h "app-downloads/$APK_FILE" | cut -f1)
  echo "✅ Downloaded $APK_FILE ($SIZE)"
else
  echo "❌ Failed to download $APK_FILE"
  exit 1
fi
