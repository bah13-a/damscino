#!/usr/bin/env bash
# Configures the e-mail sending of the activation codes (same code as the SMS), then restarts identity-service.
#
#   sudo bash infra/configure-email.sh
#
# Free SMTP accounts (docs/SMS.md):
#   Brevo : smtp-relay.brevo.com, port 587, SMTP login + SMTP key (Brevo → SMTP & API), 300 e-mails a day
#   Gmail : smtp.gmail.com, port 587, Gmail address + application password (Google account → Security)
# The values are asked on screen (the password is not displayed), or taken from the environment
# (MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM, TEST_EMAIL).
set -euo pipefail
cd "$(dirname "$0")/.."

die() { printf '\033[1;31m❌ %s\033[0m\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m✅ %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || die "Lancez ce script avec sudo."
[ -f .env ] || die ".env absent : installez d'abord le serveur avec infra/vps/deploy.sh."

setenv() {
  local tmp; tmp="$(mktemp)"
  awk -v k="$1" -v v="$2" 'BEGIN { FS = OFS = "="; done = 0 } $1 == k { print k "=" v; done = 1; next } { print }
    END { if (!done) print k "=" v }' .env > "$tmp"
  cat "$tmp" > .env && rm -f "$tmp"
  chmod 600 .env
}
current() { sed -n "s/^$1=//p" .env | tail -n1; }
ask() { # ask VAR "question" [default] [secret]
  local var="$1" question="$2" default="${3:-}" value="${!1:-}" input=""
  [ -z "$value" ] && value="$(current "$var")"
  [ -z "$value" ] && value="$default"
  if [ -t 0 ]; then
    local shown="$value"
    [ -n "${4:-}" ] && [ -n "$value" ] && shown="(déjà renseigné)"
    if [ -n "${4:-}" ]; then read -r -s -p "$question [$shown] : " input; echo; else read -r -p "$question [$shown] : " input; fi
    [ -n "$input" ] && value="$input"
  fi
  printf -v "$var" '%s' "$value"
}

echo "Compte SMTP gratuit : Brevo (smtp-relay.brevo.com) ou Gmail (smtp.gmail.com), voir docs/SMS.md."
MAIL_HOST="${MAIL_HOST:-}" MAIL_PORT="${MAIL_PORT:-}" MAIL_USERNAME="${MAIL_USERNAME:-}" MAIL_PASSWORD="${MAIL_PASSWORD:-}" MAIL_FROM="${MAIL_FROM:-}"
ask MAIL_HOST "Serveur SMTP" "smtp-relay.brevo.com"
ask MAIL_PORT "Port (587 ou 465)" "587"
ask MAIL_USERNAME "Login SMTP (Brevo → SMTP & API, ex. xxxx@smtp-brevo.com)"
ask MAIL_PASSWORD "Mot de passe / clé SMTP" "" secret
ask MAIL_FROM "Adresse d'expédition (validée dans Brevo → Senders)"
[ -n "$MAIL_HOST" ] && [ -n "$MAIL_USERNAME" ] && [ -n "$MAIL_PASSWORD" ] && [ -n "$MAIL_FROM" ] \
  || die "Serveur, identifiant, mot de passe et adresse d'expédition sont obligatoires."
[[ "$MAIL_PORT" =~ ^[0-9]+$ ]] || die "Port invalide."

TEST_EMAIL="${TEST_EMAIL:-}"
if [ -t 0 ] && [ -z "$TEST_EMAIL" ]; then
  read -r -p "Adresse pour un e-mail de test (vide pour passer) : " TEST_EMAIL
fi
if [ -n "$TEST_EMAIL" ]; then
  # same connection settings as the application: STARTTLS on 587, SSL on 465
  if [ "$MAIL_PORT" = 465 ]; then url="smtps://$MAIL_HOST:$MAIL_PORT"; tls=(); else url="smtp://$MAIL_HOST:$MAIL_PORT"; tls=(--ssl-reqd); fi
  message="$(printf 'From: Damascino Privileges <%s>\r\nTo: <%s>\r\nSubject: Test Damascino Privileges\r\n\r\nLa configuration e-mail fonctionne.\r\n' "$MAIL_FROM" "$TEST_EMAIL")"
  if printf '%s' "$message" | curl -sS --max-time 30 "${tls[@]}" --url "$url" --user "$MAIL_USERNAME:$MAIL_PASSWORD" \
       --mail-from "$MAIL_FROM" --mail-rcpt "$TEST_EMAIL" --upload-file - 2>/tmp/damascino-mail-test.log; then
    ok "E-mail de test envoyé à $TEST_EMAIL (vérifiez aussi les spams)"
  else
    cat /tmp/damascino-mail-test.log >&2
    echo "Causes fréquentes : mot de passe Gmail normal au lieu d'un mot de passe d'application ; adresse"
    echo "d'expédition non validée chez Brevo ; port bloqué (essayez 465)."
    die "Échec de l'e-mail de test. La configuration n'a pas été modifiée."
  fi
fi

setenv MAIL_PROVIDER smtp
setenv MAIL_HOST "$MAIL_HOST"
setenv MAIL_PORT "$MAIL_PORT"
setenv MAIL_USERNAME "$MAIL_USERNAME"
setenv MAIL_PASSWORD "$MAIL_PASSWORD"
setenv MAIL_FROM "$MAIL_FROM"
ok "Configuration e-mail enregistrée dans .env"
echo "Redémarrage du service d'identité…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build --no-deps identity-service
ok "Terminé : les bénéficiaires dont l'e-mail figure sur la liste du partenaire recevront le code par SMS et par e-mail."
