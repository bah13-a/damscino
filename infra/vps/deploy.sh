#!/usr/bin/env bash
# Installs (or updates) Damascino Privilèges on an Ubuntu server (AWS EC2, Oracle Cloud "Always Free", VPS…).
#
#   sudo -E bash infra/vps/deploy.sh                          # HTTPS on <ip-publique>.sslip.io (no domain needed)
#   sudo -E bash infra/vps/deploy.sh privileges.example.tn    # HTTPS on your own domain (DNS A record → this server)
#
# Private repository: the first run needs GITHUB_TOKEN=<token, read access to the repository contents> in the
# environment; it is then kept in .env and reused for the code and the Android APK.
# Re-running the script pulls the latest code, refreshes the APK and the application images; secrets and data are
# kept. The images are built by GitHub Actions (.github/workflows/deploy.yml), which also runs this script on the
# server after each change; the server only compiles them itself if they cannot be downloaded.
# Cloud firewall (AWS Security Group, Oracle security list): inbound TCP 80 and 443 must be open.
set -euo pipefail

REPO="${REPO:-github.com/bah13-a/damscino.git}"
BRANCH="${BRANCH:-claude/serene-faraday-tqmxat}"
DIR="${DIR:-/opt/damascino}"
DOMAIN="${1:-${DOMAIN:-}}"
APK_FILE=damascino-privileges.apk

log()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m❌ %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Lancez ce script avec sudo -E (le -E transmet GITHUB_TOKEN)."
# one deployment at a time (manual run and GitHub Actions run would recreate the same containers)
exec 9>/var/lock/damascino-deploy.lock
flock -n 9 || die "Un autre déploiement est déjà en cours sur ce serveur : attendez sa fin (ps aux | grep deploy.sh)."

# writes KEY=VALUE in .env (replaces the line if present)
setenv() {
  if grep -q "^$1=" .env; then
    local tmp; tmp="$(mktemp)"
    awk -v k="$1" -v v="$2" 'BEGIN { FS = OFS = "=" } $1 == k { print k "=" v; next } { print }' .env > "$tmp"
    cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

log "1/9 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null
docker compose version >/dev/null 2>&1 || die "Plugin « docker compose » absent : apt-get install docker-compose-plugin"
for tool in git curl openssl python3; do
  command -v "$tool" >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git curl openssl python3 >/dev/null; break; }
done
[ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ] && usermod -aG docker "$SUDO_USER" 2>/dev/null || true

log "2/9 Mémoire (5 services Java + PostgreSQL + RabbitMQ : 4 Go RAM+swap minimum)"
RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ] && [ "$RAM_MB" -lt 6000 ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
SWAP_MB="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)"
echo "RAM ${RAM_MB} Mo, swap ${SWAP_MB} Mo"
[ $((RAM_MB + SWAP_MB)) -ge 4000 ] || warn "Moins de 4 Go RAM+swap : les services risquent de ne pas démarrer."

log "3/9 Pare-feu local : ports 80 et 443"
# Oracle Ubuntu images block everything except SSH with iptables rules
if command -v iptables >/dev/null 2>&1; then
  for port in 80 443; do
    iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT 2>/dev/null || true
  done
  command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1 || true
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q active; then ufw allow 80,443/tcp >/dev/null; fi

log "4/9 Code source ($BRANCH)"
# never wait for a username/password: a refused token must stop with a clear message
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat
TOKEN="${GITHUB_TOKEN:-}"
[ -z "$TOKEN" ] && [ -f "$DIR/.env" ] && TOKEN="$(sed -n 's/^GITHUB_TOKEN=//p' "$DIR/.env" | tail -n1)"
[ -z "$TOKEN" ] && [ -d "$DIR/.git" ] && TOKEN="$(git -C "$DIR" remote get-url origin | sed -n 's#^https://x-access-token:\([^@]*\)@.*#\1#p')"
# the token is only put in the URL of this fetch: never written in .git/config
URL="https://${TOKEN:+x-access-token:${TOKEN}@}${REPO}"
# the folder may belong to another user (e.g. ubuntu): otherwise git refuses it as root ("dubious ownership")
git config --global --get-all safe.directory 2>/dev/null | grep -qx "$DIR" || git config --global --add safe.directory "$DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" remote set-url origin "https://$REPO"
  git -C "$DIR" fetch --quiet "$URL" "$BRANCH" || die "git fetch impossible : GITHUB_TOKEN manquant ou expiré (sudo -E avec GITHUB_TOKEN=…)."
  # the server is a deployment copy: local edits of tracked files are discarded (.env and the APKs are not tracked)
  git -C "$DIR" checkout --quiet --force -B "$BRANCH" FETCH_HEAD
else
  git clone --quiet --branch "$BRANCH" "$URL" "$DIR" || die "git clone impossible : dépôt privé, exportez GITHUB_TOKEN puis sudo -E bash deploy.sh."
  git -C "$DIR" remote set-url origin "https://$REPO"
fi
cd "$DIR"
git --no-pager log -1 --format='Version : %h — %s'

log "5/9 Configuration (.env)"
# a custom domain is kept; an <ip>.sslip.io address follows the current public IP
# (EC2 changes it at every stop/start without an Elastic IP)
if [ -z "$DOMAIN" ] && [ -f .env ]; then
  DOMAIN="$(sed -n 's/^DOMAIN=//p' .env | tail -n1)"
  case "$DOMAIN" in *.sslip.io) DOMAIN="" ;; esac
fi
if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS --max-time 10 https://checkip.amazonaws.com || curl -fsS --max-time 10 https://api.ipify.org)"
  IP="$(echo "$IP" | tr -d '[:space:]')"
  DOMAIN="${IP//./-}.sslip.io"
fi
if [ ! -f .env ]; then
  secret() { openssl rand -base64 36 | tr -d '/+=' | cut -c1-40; }
  ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=')"
  cat > .env <<ENV
DB_PASSWORD=$(secret)
JWT_SECRET=$(secret)
QR_SECRET=$(secret)
CREDENTIALS_SECRET=$(secret)
ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV
  echo "Mot de passe initial de l'administrateur « admin » : $ADMIN_PASSWORD (à changer à la première connexion)"
fi
setenv DOMAIN "$DOMAIN"
setenv PUBLIC_URL "https://$DOMAIN"
# a plain « docker compose … » in this folder then always includes HTTPS (Caddy) and the production settings
setenv COMPOSE_FILE "docker-compose.yml:docker-compose.prod.yml"
setenv ANDROID_APP_URL "/downloads/$APK_FILE"
# personal token kept for the next manual runs; the short-lived token of a GitHub Actions run (ghs_…) is not
case "$TOKEN" in ''|ghs_*) ;; *) setenv GITHUB_TOKEN "$TOKEN" ;; esac
grep -q '^SMS_GATEWAY_USER=' .env || printf 'SMS_GATEWAY_USER=\nSMS_GATEWAY_PASSWORD=\n' >> .env
chmod 600 .env
grep -q '^SMS_GATEWAY_USER=.\+' .env || warn "Renseignez SMS_GATEWAY_USER et SMS_GATEWAY_PASSWORD dans $DIR/.env (docs/SMS.md), sinon les codes SMS ne partent pas."
echo "Domaine : $DOMAIN"

log "6/9 Application Android (release android-prod)"
mkdir -p app-downloads
APK_OK=1
GITHUB_TOKEN="$TOKEN" bash infra/download-apk.sh prod || {
  APK_OK=0
  warn "APK non installée : le site fonctionne, mais le QR code de téléchargement renverra une erreur 404."
}
# never serve a file that is not a real APK (placeholders of older scripts)
if [ -f "app-downloads/$APK_FILE" ] && [ "$(stat -c %s "app-downloads/$APK_FILE")" -lt 1000000 ]; then
  rm -f "app-downloads/$APK_FILE"
  APK_OK=0
  warn "Ancienne APK factice supprimée."
fi

log "7/9 Images de l'application et démarrage"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
# images built by GitHub Actions (private: the token needs read access to the packages, which the token of an
# Actions run has; a personal token needs the read:packages scope). Otherwise compiled here (15 to 30 minutes).
UP=(up -d --remove-orphans --no-build)
if [ -n "$TOKEN" ] && printf '%s' "$TOKEN" | docker login ghcr.io -u x-access-token --password-stdin >/dev/null 2>&1 \
   && "${COMPOSE[@]}" pull --quiet; then
  echo "✅ Images téléchargées depuis ghcr.io (version ${IMAGE_TAG:-latest})"
else
  warn "Images GitHub indisponibles (workflow « Images Docker et déploiement serveur » pas encore lancé, ou jeton sans read:packages) : compilation sur le serveur."
  UP=(up -d --remove-orphans --build)
fi
docker logout ghcr.io >/dev/null 2>&1 || true
started=0
for attempt in 1 2 3; do
  if "${COMPOSE[@]}" "${UP[@]}"; then started=1; break; fi
  warn "Tentative $attempt : un service n'a pas démarré à temps."
  for svc in $("${COMPOSE[@]}" ps -a --format '{{.Service}} {{.Health}} {{.State}}' | awk '$2 == "unhealthy" || $3 == "exited" {print $1}'); do
    echo "── Dernières lignes de $svc ──"
    "${COMPOSE[@]}" logs --tail=40 "$svc" || true
    "${COMPOSE[@]}" restart "$svc" >/dev/null || true
  done
done
"${COMPOSE[@]}" ps -a
if [ "$started" != 1 ]; then
  if dmesg 2>/dev/null | grep -qiE 'out of memory|oom-kill'; then
    free -m
    warn "Mémoire insuffisante : Linux a arrêté un service Java (code 137). Agrandissez l'instance (4 Go de RAM, ex. t3.medium) ou vérifiez le swap (free -m)."
  fi
  die "Les services n'ont pas démarré. Logs complets : cd $DIR && docker compose logs <service>"
fi

log "8/9 Vérifications"
ok=1
# Caddy obtains the Let's Encrypt certificate at the first start (port 80 must be reachable from the Internet)
for _ in $(seq 1 24); do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true)"
  [ "$code" = 200 ] && break
  sleep 5
done
if [ "$code" = 200 ]; then echo "✅ Site HTTPS : OK"; else ok=0; warn "Site HTTPS : HTTP $code (docker compose logs caddy frontend)"; fi

if [ "$APK_OK" = 1 ]; then
  headers="$(curl -skI --max-time 20 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/downloads/$APK_FILE" | tr -d '\r')"
  size="$(stat -c %s "app-downloads/$APK_FILE")"
  if grep -qi '^HTTP/[0-9.]* 200' <<<"$headers" \
     && grep -qi '^content-type: application/vnd.android.package-archive' <<<"$headers" \
     && grep -qi "^content-length: $size\$" <<<"$headers"; then
    echo "✅ APK servie : https://$DOMAIN/downloads/$APK_FILE ($((size / 1048576)) Mo)"
  else
    ok=0; warn "APK mal servie par Caddy :"; echo "$headers"
  fi
fi

if curl -s -o /dev/null --max-time 10 "http://$DOMAIN/"; then
  echo "✅ Accessible depuis Internet"
else
  ok=0; warn "Le site n'est pas joignable par son adresse publique : ouvrez les ports TCP 80 et 443 en entrée (AWS : EC2 → Security Groups → Inbound rules)."
fi

log "9/9 Sauvegarde quotidienne de la base (02:30, conservée 30 jours)"
cat > /etc/cron.d/damascino-backup <<CRON
30 2 * * * root mkdir -p /var/backups/damascino && cd $DIR && docker compose exec -T postgres pg_dump -U damascino damascino | gzip > /var/backups/damascino/damascino_\$(date +\%F).sql.gz && find /var/backups/damascino -name '*.sql.gz' -mtime +30 -delete
CRON

echo
if [ "$ok" = 1 ] && [ "$APK_OK" = 1 ]; then
  echo "✅ Déploiement terminé sans erreur."
else
  warn "Déploiement terminé avec des avertissements (voir ci-dessus)."
fi
echo "   Site        : https://$DOMAIN   (administration : https://$DOMAIN/admin/connexion)"
echo "   Application : https://$DOMAIN/downloads/$APK_FILE"
echo "   Nouvelle APK publiée par GitHub Actions : sudo bash $DIR/infra/download-apk.sh   (sans redémarrage)"
docker image prune -f >/dev/null 2>&1 || true
echo "   Suivi       : cd $DIR && docker compose logs -f"
