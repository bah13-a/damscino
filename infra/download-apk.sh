#!/usr/bin/env bash
# Downloads the Android app published by .github/workflows/mobile-apk.yml into app-downloads/,
# which Caddy serves at https://<domaine>/downloads/<fichier>.apk (no restart needed after an update).
#
#   sudo bash infra/download-apk.sh          # production app  (release android-prod)
#   sudo bash infra/download-apk.sh test     # test app        (release android-test)
#
# The repository is private: GitHub answers "Not Found" without a token. The token (read access to the
# repository contents) is taken from $GITHUB_TOKEN, else the GITHUB_TOKEN= line of .env, else the git clone.
# The file in place is only replaced by a complete APK whose size and SHA-256 match the release.
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-prod}" in
  prod) TAG=android-prod; FILE=damascino-privileges.apk ;;
  test) TAG=android-test; FILE=damascino-privileges-test.apk ;;
  # APK built elsewhere (EAS Build, infra/build-apk.sh): same checks, no GitHub release
  url) TAG=""; FILE=damascino-privileges.apk; SOURCE_URL="${2:-}"; [ -n "$SOURCE_URL" ] || { echo "Usage: $0 url <adresse https de l APK>" >&2; exit 2; } ;;
  *) echo "Usage: $0 [prod|test|url <adresse>]" >&2; exit 2 ;;
esac
REPO="${GITHUB_REPO:-bah13-a/damscino}"
API="https://api.github.com/repos/$REPO"

fail() { echo "❌ $*" >&2; exit 1; }

# checks an APK downloaded in $1 (ZIP with manifest, code and resources, signed) before it replaces the one in place
check_apk() {
  python3 - "$1" <<'PY' || fail "Le fichier téléchargé n'est pas une APK Android valide (le fichier en place est conservé)."
import sys, zipfile
names = set(zipfile.ZipFile(sys.argv[1]).namelist())
missing = {"AndroidManifest.xml", "classes.dex", "resources.arsc"} - names
if missing:
    sys.exit("APK incomplète, manque : " + ", ".join(sorted(missing)))
# Android refuses an unsigned APK: v2/v3 signing block, or v1 signature files in META-INF/
with open(sys.argv[1], "rb") as f:
    f.seek(0, 2); f.seek(max(0, f.tell() - 64 * 1024 * 1024))
    signed_v2 = b"APK Sig Block 42" in f.read()
if not signed_v2 and not any(n.startswith("META-INF/") and n.endswith((".RSA", ".EC", ".DSA")) for n in names):
    sys.exit("APK non signée : Android refuserait de l'installer")
PY
}

if [ -z "$TAG" ]; then
  mkdir -p app-downloads
  TMP="$(mktemp app-downloads/.download.XXXXXX)"
  trap 'rm -f "$TMP"' EXIT
  echo "⬇ $FILE ($SOURCE_URL)"
  curl -fsSL --retry 3 --connect-timeout 20 -o "$TMP" "$SOURCE_URL" || fail "Téléchargement de $FILE impossible."
  SIZE="$(stat -c %s "$TMP")"
  [ "$SIZE" -gt 1048576 ] || fail "Fichier trop petit ($SIZE octets) : ce n'est pas l'application."
  check_apk "$TMP"
  chmod 644 "$TMP"
  mv -f "$TMP" "app-downloads/$FILE"
  trap - EXIT
  echo "✅ $FILE installé ($((SIZE / 1048576)) Mo) → /downloads/$FILE"
  exit 0
fi

TOKEN="${GITHUB_TOKEN:-}"
[ -z "$TOKEN" ] && [ -f .env ] && TOKEN="$(sed -n 's/^GITHUB_TOKEN=//p' .env | tail -n1)"
[ -z "$TOKEN" ] && TOKEN="$(git remote get-url origin 2>/dev/null | sed -n 's#^https://x-access-token:\([^@]*\)@.*#\1#p')"
AUTH=()
[ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")

echo "⬇ $FILE (release $TAG de $REPO)"
RELEASE="$(curl -sS -L --retry 3 "${AUTH[@]}" -H "Accept: application/vnd.github+json" -w '\n%{http_code}' "$API/releases/tags/$TAG")"
STATUS="${RELEASE##*$'\n'}"
RELEASE="${RELEASE%$'\n'*}"
case "$STATUS" in
  200) ;;
  401) fail "GITHUB_TOKEN refusé par GitHub (expiré ou révoqué) : créez-en un nouveau et mettez-le dans .env." ;;
  404) if [ -z "$TOKEN" ]; then
         fail "Dépôt privé : un GITHUB_TOKEN est nécessaire (GitHub → Settings → Developer settings → Fine-grained tokens, dépôt $REPO, « Contents : Read-only »), puis ajoutez GITHUB_TOKEN=<token> dans .env."
       fi
       fail "Release $TAG introuvable : lancez Actions → « Application mobile (APK Android) » → Run workflow (environnement ${1:-prod})." ;;
  *) fail "GitHub a répondu HTTP $STATUS pour la release $TAG." ;;
esac

ASSET=""
ASSET="$(printf '%s' "$RELEASE" | python3 -c '
import json, sys
for a in json.load(sys.stdin).get("assets", []):
    if a.get("name") == sys.argv[1] and a.get("state") == "uploaded":
        print(a["id"], a["size"], (a.get("digest") or "-").removeprefix("sha256:"))
        break
' "$FILE")"
[ -n "$ASSET" ] || fail "La release $TAG ne contient pas $FILE : relancez le workflow de l'application mobile."
read -r ASSET_ID SIZE DIGEST <<<"$ASSET"

if [ -f "app-downloads/$FILE" ] && [ "$DIGEST" != "-" ] \
   && echo "$DIGEST  app-downloads/$FILE" | sha256sum -c --quiet - >/dev/null 2>&1; then
  echo "✅ $FILE déjà à jour ($((SIZE / 1048576)) Mo)"
  exit 0
fi

mkdir -p app-downloads
TMP="$(mktemp app-downloads/.download.XXXXXX)"
trap 'rm -f "$TMP"' EXIT
# the asset endpoint redirects to a signed storage URL; curl does not forward the token to that other host
curl -fsSL --retry 3 --connect-timeout 20 "${AUTH[@]}" -H "Accept: application/octet-stream" \
  -o "$TMP" "$API/releases/assets/$ASSET_ID" || fail "Téléchargement de $FILE interrompu."

GOT="$(stat -c %s "$TMP")"
[ "$GOT" = "$SIZE" ] || fail "Fichier incomplet : $GOT octets reçus au lieu de $SIZE (le fichier en place est conservé)."
if [ "$DIGEST" != "-" ]; then
  echo "$DIGEST  $TMP" | sha256sum -c --quiet - || fail "Empreinte SHA-256 différente de la release (le fichier en place est conservé)."
fi
check_apk "$TMP"
chmod 644 "$TMP"
mv -f "$TMP" "app-downloads/$FILE"
trap - EXIT
echo "✅ $FILE installé ($((SIZE / 1048576)) Mo, SHA-256 vérifié) → /downloads/$FILE"
