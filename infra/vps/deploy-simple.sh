#!/usr/bin/env bash
# Simple deployment: just launch web and prepare APK for scanning
# Usage:
#   sudo bash deploy-simple.sh                      # HTTPS on <ip-publique>.sslip.io
#   sudo bash deploy-simple.sh privileges.example.tn   # HTTPS on your own domain

set -euo pipefail

REPO="${REPO:-github.com/bah13-a/damscino.git}"
BRANCH="${BRANCH:-claude/serene-faraday-tqmxat}"
DIR="${DIR:-/opt/damascino}"
DOMAIN="${1:-${DOMAIN:-}}"

log() { printf '\n\033[1;31m▶ %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script avec sudo"; exit 1; }

log "1/4 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null

log "2/4 Code source ($BRANCH)"
AUTH=""
[ -n "${GITHUB_TOKEN:-}" ] && AUTH="x-access-token:${GITHUB_TOKEN}@"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --quiet origin "$BRANCH" && git -C "$DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
else
  apt-get install -y -qq git >/dev/null
  git clone --quiet --branch "$BRANCH" "https://${AUTH}${REPO}" "$DIR"
fi
cd "$DIR"

log "3/4 Configuration (.env)"
if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS https://api.ipify.org)"
  DOMAIN="${IP//./-}.sslip.io"
fi
if [ ! -f .env ]; then
  secret() { openssl rand -base64 36 | tr -d '/+=' | cut -c1-40; }
  ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=')"
  cat > .env <<ENV
DOMAIN=$DOMAIN
PUBLIC_URL=https://$DOMAIN
DB_PASSWORD=$(secret)
JWT_SECRET=$(secret)
QR_SECRET=$(secret)
CREDENTIALS_SECRET=$(secret)
ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV
  chmod 600 .env
  echo "Mot de passe initial de l'administrateur « admin » : $ADMIN_PASSWORD (à changer à la première connexion)"
else
  sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/; s#^PUBLIC_URL=.*#PUBLIC_URL=https://$DOMAIN#" .env
fi

log "3.5/4 Téléchargement APK Android pour le scanner"
bash "$DIR/infra/download-apk.sh" prod || echo "⚠ APK not yet available on GitHub Releases (first build?). Will be served once available."

log "4/4 Lancement des services web (10 à 20 minutes la première fois)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

echo
echo "✅ Damascino Privilèges déployé : https://$DOMAIN"
echo "   Admin : https://$DOMAIN/admin/connexion"
echo "   APK Scanner : https://$DOMAIN/downloads/damascino-privileges.apk"
echo
echo "   Suivi : cd $DIR && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
