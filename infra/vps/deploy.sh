#!/usr/bin/env bash
# Installs (or updates) Damascino Privilèges on a fresh Ubuntu server, e.g. an Oracle Cloud "Always Free" VM.
#
#   sudo bash deploy.sh                      # HTTPS on <ip-publique>.sslip.io (no domain needed)
#   sudo bash deploy.sh privileges.example.tn   # HTTPS on your own domain (DNS A record → this server)
#
# Private repository: export GITHUB_TOKEN=<token with read access> before running.
# Re-running the script pulls the latest code and rebuilds; secrets and data are kept.
set -euo pipefail

REPO="${REPO:-github.com/bah13-a/damscino.git}"
BRANCH="${BRANCH:-claude/serene-faraday-tqmxat}"
DIR="${DIR:-/opt/damascino}"
DOMAIN="${1:-${DOMAIN:-}}"

log() { printf '\n\033[1;31m▶ %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script avec sudo"; exit 1; }

log "1/7 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null

log "2/7 Mémoire d'échange (utile pour la compilation sur les petites machines)"
if [ "$(swapon --show | wc -l)" -eq 0 ] && [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 6000 ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "3/7 Pare-feu : ports 80 et 443"
# Oracle Ubuntu images block everything except SSH with iptables rules
if command -v iptables >/dev/null 2>&1; then
  for port in 80 443; do
    iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -p tcp --dport "$port" -j ACCEPT 2>/dev/null || true
  done
  command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1 || true
fi
command -v ufw >/dev/null 2>&1 && ufw status | grep -q active && ufw allow 80,443/tcp >/dev/null || true

log "4/7 Code source ($BRANCH)"
AUTH=""
[ -n "${GITHUB_TOKEN:-}" ] && AUTH="x-access-token:${GITHUB_TOKEN}@"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --quiet origin "$BRANCH" && git -C "$DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
else
  apt-get install -y -qq git >/dev/null
  git clone --quiet --branch "$BRANCH" "https://${AUTH}${REPO}" "$DIR"
fi
cd "$DIR"

log "5/7 Configuration (.env)"
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
# SMS sending (docs/SMS.md): filled in by hand with the credentials of the "SMS Gateway for Android" phone
grep -q '^SMS_GATEWAY_USER=' .env || printf 'SMS_GATEWAY_USER=\nSMS_GATEWAY_PASSWORD=\n' >> .env
grep -q '^SMS_GATEWAY_USER=.\+' .env || echo "À faire : renseigner SMS_GATEWAY_USER et SMS_GATEWAY_PASSWORD dans $DIR/.env (voir docs/SMS.md), sinon les codes SMS ne partent pas."

log "5.5/7 Téléchargement APK Android"
bash "$DIR/infra/download-apk.sh" prod || echo "⚠ APK not yet available on GitHub Releases (first build?). Will be served once available."

log "6/7 Construction et démarrage (10 à 20 minutes la première fois)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

log "7/7 Sauvegarde quotidienne de la base (02:30, conservée 30 jours)"
cat > /etc/cron.d/damascino-backup <<CRON
30 2 * * * root mkdir -p /var/backups/damascino && cd $DIR && docker compose exec -T postgres pg_dump -U damascino damascino | gzip > /var/backups/damascino/damascino_\$(date +\%F).sql.gz && find /var/backups/damascino -name '*.sql.gz' -mtime +30 -delete
CRON

echo
echo "✅ Damascino Privilèges : https://$DOMAIN   (administration : https://$DOMAIN/admin/connexion)"
echo "   Suivi : cd $DIR && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
