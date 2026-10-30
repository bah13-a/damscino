#!/usr/bin/env bash
# Compiles the Android app ON THIS SERVER (Docker, no GitHub Actions, no Expo account), for this server's address,
# and puts it in app-downloads/ where the QR code of the site points.
#
#   cd /opt/damascino && sudo bash infra/build-apk.sh
#
# An Android build needs memory: 8 GB (RAM + swap) at least, 16 GB RAM to be fast. On a small instance, enlarge it
# for the time of the build (EC2 → Stop → Change instance type, e.g. t3.xlarge → Start, then back), with an Elastic
# IP so that the address stays the same. First build: 30 to 60 minutes (downloads of the Android SDK and NDK, kept for
# the next builds); then 10 to 20 minutes.
# Signing: the APK is signed with the debug key of the Expo template, like the previous APKs built without a key, so
# it installs as an update of them. With a key of your own, put it in /opt/damascino/android-signing/ (release.keystore
# and signing.properties: storePassword=…, keyAlias=…, keyPassword=…).
set -euo pipefail
cd "$(dirname "$0")/.."

die()  { printf '\033[1;31m❌ %s\033[0m\n' "$*" >&2; exit 1; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✅ %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || die "Lancez ce script avec sudo."
[ -f .env ] || die ".env absent : installez d'abord le serveur avec infra/vps/deploy.sh."
command -v docker >/dev/null 2>&1 || die "Docker absent : installez d'abord le serveur avec infra/vps/deploy.sh."

DOMAIN="$(sed -n 's/^DOMAIN=//p' .env | tail -n1)"
[ -n "$DOMAIN" ] || die "DOMAIN absent de .env : relancez infra/vps/deploy.sh."
API_URL="https://$DOMAIN"
case "$DOMAIN" in
  *.sslip.io) warn "L'application sera liée à $API_URL : sans Elastic IP, cette adresse change au prochain arrêt de l'instance." ;;
esac

RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
SWAP_MB="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)"
echo "Mémoire : RAM ${RAM_MB} Mo, swap ${SWAP_MB} Mo"
if [ $((RAM_MB + SWAP_MB)) -lt 7500 ]; then
  die "Pas assez de mémoire pour compiler une application Android (8 Go RAM+swap minimum). Agrandissez l'instance le temps de la compilation (ex. t3.xlarge), ou ajoutez du swap : sudo fallocate -l 8G /swapfile2 && sudo chmod 600 /swapfile2 && sudo mkswap /swapfile2 && sudo swapon /swapfile2"
fi
if [ "$RAM_MB" -ge 12000 ]; then HEAP=4g; WORKERS=4; elif [ "$RAM_MB" -ge 6000 ]; then HEAP=3g; WORKERS=2; else HEAP=2g; WORKERS=1; fi
[ "$RAM_MB" -ge 6000 ] || warn "Peu de RAM (${RAM_MB} Mo) : la compilation passera par le swap et peut prendre plusieurs heures."

CACHE=/var/cache/damascino-apk
SRC="$CACHE/src"
mkdir -p "$SRC"
# fresh copy of the app (dependencies and Gradle caches are kept in Docker volumes between builds)
find "$SRC" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C mobile --exclude=node_modules --exclude=dist --exclude=.expo --exclude=android --exclude=ios -cf - . | tar -C "$SRC" -xf -
SIGNING=()
if [ -f android-signing/release.keystore ] && [ -f android-signing/signing.properties ]; then
  SIGNING=(-v "$PWD/android-signing:/signing:ro" -v "$PWD/.github/scripts:/scripts:ro")
  echo "Signature avec la clé de android-signing/"
fi

echo "▶ Environnement de compilation Android ($(date +%H:%M))"
docker build -q -t damascino-android-builder:1 infra/android-builder >/dev/null || die "Image de compilation impossible à construire."

echo "▶ Compilation de l'application pour $API_URL ($(date +%H:%M)) — journal : $CACHE/build.log"
docker run --rm \
  -e APP_ENV=prod -e EXPO_PUBLIC_APP_ENV=prod -e EXPO_PUBLIC_API_URL="$API_URL" -e EXPO_PUBLIC_ALLOW_SERVER_CHANGE=0 \
  -e EXPO_NO_TELEMETRY=1 -e CI=1 -e HEAP="$HEAP" -e WORKERS="$WORKERS" \
  -v "$SRC":/app -v damascino-android-sdk:/opt/android-sdk -v damascino-gradle:/root/.gradle -v damascino-npm:/root/.npm \
  "${SIGNING[@]}" damascino-android-builder:1 bash -euo pipefail -c '
    npm ci --no-audit --no-fund --loglevel=error
    npx expo prebuild --platform android --no-install --clean
    cat >> android/gradle.properties <<PROPS
org.gradle.jvmargs=-Xmx$HEAP -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError
org.gradle.workers.max=$WORKERS
org.gradle.parallel=false
kotlin.daemon.jvmargs=-Xmx1g
PROPS
    if [ -f /signing/release.keystore ]; then
      cp /signing/release.keystore android/app/release.keystore
      sed -n "s/^storePassword=/DP_UPLOAD_STORE_PASSWORD=/p; s/^keyAlias=/DP_UPLOAD_KEY_ALIAS=/p; s/^keyPassword=/DP_UPLOAD_KEY_PASSWORD=/p" \
        /signing/signing.properties >> android/gradle.properties
      echo "DP_UPLOAD_STORE_FILE=release.keystore" >> android/gradle.properties
      node /scripts/android-release-signing.mjs android/app/build.gradle
    fi
    cd android
    ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --no-daemon
    # an unsigned or truncated APK is refused by Android: never publish one
    BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -n1)"
    "$BT/apksigner" verify app/build/outputs/apk/release/app-release.apk
  ' >"$CACHE/build.log" 2>&1 || { tail -n 40 "$CACHE/build.log"; die "Compilation impossible (journal complet : $CACHE/build.log)."; }

APK="$SRC/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || die "APK introuvable après la compilation (journal : $CACHE/build.log)."
bash infra/download-apk.sh url "$APK"
ok "Application compilée ($(date +%H:%M)) : $API_URL/downloads/damascino-privileges.apk (QR code de la page d'accueil)"
