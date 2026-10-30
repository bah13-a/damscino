#!/usr/bin/env bash
# Builds the Android app for THIS server with Expo's EAS Build (free plan), then installs it in app-downloads/ where
# the QR code of the site points. Use it when GitHub Actions is not available.
#
#   cd /opt/damascino && sudo bash infra/build-apk.sh
#
# Needs a free Expo account and an access token (expo.dev → Account settings → Access tokens → Create token): asked
# on screen the first time, then kept in .env (EXPO_TOKEN). The app is linked to an Expo project on the first run
# (EAS_PROJECT_ID, kept in .env). Answer « Yes » when EAS offers to generate the Android signing key: it is kept by
# Expo and reused for every later build, so the next APKs install as updates.
# The compilation runs on Expo's servers (from a few minutes to more than an hour on the free plan, depending on the
# queue); this server only uploads the project and downloads the result.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { printf '\033[1;31m❌ %s\033[0m\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m✅ %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || die "Lancez ce script avec sudo."
[ -f .env ] || die ".env absent : installez d'abord le serveur avec infra/vps/deploy.sh."
[ -t 0 ] || die "Lancez ce script dans un terminal (EAS pose une question lors de la première compilation)."
command -v docker >/dev/null 2>&1 || die "Docker absent : installez d'abord le serveur avec infra/vps/deploy.sh."

setenv() {
  if grep -q "^$1=" .env; then
    local tmp; tmp="$(mktemp)"
    awk -v k="$1" -v v="$2" 'BEGIN { FS = OFS = "=" } $1 == k { print k "=" v; next } { print }' .env > "$tmp"
    cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
  chmod 600 .env
}
current() { sed -n "s/^$1=//p" .env | tail -n1; }

DOMAIN="$(current DOMAIN)"
[ -n "$DOMAIN" ] || die "DOMAIN absent de .env : relancez infra/vps/deploy.sh."
API_URL="https://$DOMAIN"
case "$DOMAIN" in
  *.sslip.io) echo "⚠ L'application sera liée à $API_URL. Sans Elastic IP, cette adresse change au prochain arrêt/démarrage" \
                   "de l'instance et l'application ne fonctionnerait plus : associez d'abord une Elastic IP." ;;
esac

EXPO_TOKEN="${EXPO_TOKEN:-$(current EXPO_TOKEN)}"
if [ -z "$EXPO_TOKEN" ]; then
  echo "Jeton Expo : expo.dev → Account settings → Access tokens → Create token (compte Expo gratuit)."
  read -r -s -p "Collez le jeton (il n'est pas affiché) : " EXPO_TOKEN; echo
  [ -n "$EXPO_TOKEN" ] || die "Jeton Expo obligatoire."
  setenv EXPO_TOKEN "$EXPO_TOKEN"
fi
EAS_PROJECT_ID="$(current EAS_PROJECT_ID)"

# working copy: the server address goes into the "apk" profile, and the repository files stay untouched
WORK="$(mktemp -d /tmp/damascino-eas.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
tar -C mobile --exclude=node_modules --exclude=dist --exclude=.expo -cf - . | tar -C "$WORK" -xf -
python3 - "$WORK/eas.json" "$API_URL" <<'PY'
import json, sys
path, url = sys.argv[1], sys.argv[2]
config = json.load(open(path))
config["build"]["apk"]["env"]["EXPO_PUBLIC_API_URL"] = url
json.dump(config, open(path, "w"), indent=2)
PY

echo "▶ Compilation de l'application pour $API_URL sur EAS Build ($(date +%H:%M))…"
docker run --rm -it -e EXPO_TOKEN -e EAS_PROJECT_ID="$EAS_PROJECT_ID" -e EAS_NO_VCS=1 -e EXPO_NO_TELEMETRY=1 \
  -v "$WORK":/app -w /app node:22 bash -euo pipefail -c '
    npm ci --no-audit --no-fund --loglevel=error
    EAS="npx --yes eas-cli@latest"
    if [ -n "$EAS_PROJECT_ID" ]; then
      $EAS init --id "$EAS_PROJECT_ID" --force --non-interactive
    else
      $EAS init --force --non-interactive
    fi
    $EAS build --platform android --profile apk --wait
    $EAS build:list --platform android --status finished --limit 1 --json --non-interactive > /app/.last-build.json
  ' || die "Compilation EAS impossible : voir les messages ci-dessus (jeton Expo, quota du plan gratuit…)."

PROJECT_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["expo"]["extra"]["eas"]["projectId"])' "$WORK/app.json" 2>/dev/null || true)"
[ -n "$PROJECT_ID" ] && setenv EAS_PROJECT_ID "$PROJECT_ID"
APK_URL="$(python3 - "$WORK/.last-build.json" <<'PY'
import json, sys
builds = json.load(open(sys.argv[1]))
artifacts = (builds[0] if builds else {}).get("artifacts") or {}
print(artifacts.get("applicationArchiveUrl") or artifacts.get("buildUrl") or "")
PY
)"
[ -n "$APK_URL" ] || die "Compilation terminée mais adresse de l'APK introuvable : téléchargez-la sur expo.dev puis « sudo bash infra/download-apk.sh url <adresse> »."

bash infra/download-apk.sh url "$APK_URL"
ok "Application disponible : $API_URL/downloads/damascino-privileges.apk (QR code de la page d'accueil)"
echo "Sur un téléphone où l'ancienne application est installée : désinstallez-la d'abord si Android refuse la mise à jour" \
     "(clé de signature différente), puis installez la nouvelle."
