#!/usr/bin/env bash
# Configures SMS sending (activation codes of the beneficiaries) on the server, then restarts identity-service.
#
#   sudo bash infra/configure-sms.sh twilio            # Twilio (paid, professional)
#   sudo bash infra/configure-sms.sh android-gateway   # phone with a Tunisian SIM + "SMS Gateway for Android" (free)
#
# The values are asked on screen (the Twilio token is not displayed), or taken from the environment:
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID, SMS_GATEWAY_USER, ...
# See docs/SMS.md.
set -euo pipefail
cd "$(dirname "$0")/.."

die()  { printf '\033[1;31m❌ %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m✅ %s\033[0m\n' "$*"; }
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
  local var="$1" question="$2" default="${3:-}" value="${!1:-}"
  [ -z "$value" ] && value="$(current "$var")"
  [ -z "$value" ] && value="$default"
  if [ -t 0 ]; then
    local shown="$value"
    [ -n "${4:-}" ] && [ -n "$value" ] && shown="(déjà renseigné)"
    if [ -n "${4:-}" ]; then read -r -s -p "$question [${shown}] : " input; echo; else read -r -p "$question [${shown}] : " input; fi
    [ -n "$input" ] && value="$input"
  fi
  printf -v "$var" '%s' "$value"
}

case "${1:-}" in
  twilio)
    echo "Identifiants Twilio : console.twilio.com → Account Info (Account SID et Auth Token)."
    ask TWILIO_ACCOUNT_SID "Account SID (AC…)"
    ask TWILIO_AUTH_TOKEN "Auth Token" "" secret
    ask TWILIO_FROM "Expéditeur : nom (DAMASCINO, 11 caractères max) ou numéro Twilio (+1…)" "DAMASCINO"
    ask TWILIO_MESSAGING_SERVICE_SID "Messaging Service SID (MG…, facultatif, remplace l'expéditeur)"
    [[ "$TWILIO_ACCOUNT_SID" == AC* ]] || die "Account SID invalide : il commence par AC."
    [ -n "$TWILIO_AUTH_TOKEN" ] || die "Auth Token manquant."
    [ -n "$TWILIO_FROM" ] || [ -n "$TWILIO_MESSAGING_SERVICE_SID" ] || die "Indiquez un expéditeur ou un Messaging Service."

    # free check of the credentials (no SMS sent)
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
      "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" || true)"
    case "$code" in
      200) ok "Identifiants Twilio valides" ;;
      401|404) die "Twilio refuse ces identifiants (HTTP $code) : vérifiez l'Account SID et l'Auth Token." ;;
      *) die "Twilio injoignable (HTTP $code) : vérifiez l'accès Internet du serveur." ;;
    esac

    TEST_PHONE="${TEST_PHONE:-}"
    if [ -t 0 ] && [ -z "$TEST_PHONE" ]; then
      read -r -p "Numéro tunisien pour un SMS de test (8 chiffres, vide pour passer) : " TEST_PHONE
    fi
    if [ -n "$TEST_PHONE" ]; then
      TEST_PHONE="${TEST_PHONE//[^0-9]/}"; TEST_PHONE="${TEST_PHONE#216}"
      [ "${#TEST_PHONE}" -eq 8 ] || die "Numéro de test invalide : 8 chiffres attendus."
      sender=(--data-urlencode "From=$TWILIO_FROM")
      [ -n "$TWILIO_MESSAGING_SERVICE_SID" ] && sender=(--data-urlencode "MessagingServiceSid=$TWILIO_MESSAGING_SERVICE_SID")
      response="$(curl -s -w '\n%{http_code}' --max-time 20 -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
        "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
        --data-urlencode "To=+216$TEST_PHONE" --data-urlencode "Body=Damascino Privileges : test d'envoi SMS reussi." \
        "${sender[@]}")"
      status="${response##*$'\n'}"
      if [ "$status" = 201 ]; then
        ok "SMS de test envoyé au +216$TEST_PHONE"
      else
        echo "${response%$'\n'*}"
        echo "Causes fréquentes : 21408 = envoi vers la Tunisie non autorisé (Console → Messaging → Settings → Geo"
        echo "permissions → cocher Tunisia) ; 21212/21606 = expéditeur refusé (essayez un numéro Twilio) ; compte d'essai :"
        echo "seuls les numéros vérifiés reçoivent les SMS."
        die "Twilio a refusé le SMS de test (HTTP $status). La configuration n'a pas été modifiée."
      fi
    fi

    setenv SMS_PROVIDER twilio
    setenv TWILIO_ACCOUNT_SID "$TWILIO_ACCOUNT_SID"
    setenv TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN"
    setenv TWILIO_FROM "$TWILIO_FROM"
    setenv TWILIO_MESSAGING_SERVICE_SID "$TWILIO_MESSAGING_SERVICE_SID"
    ;;
  android-gateway)
    echo "Identifiants affichés par l'application SMS Gateway for Android (rubrique Cloud Server), voir docs/SMS.md."
    ask SMS_GATEWAY_USER "Nom d'utilisateur"
    ask SMS_GATEWAY_PASSWORD "Mot de passe" "" secret
    [ -n "$SMS_GATEWAY_USER" ] && [ -n "$SMS_GATEWAY_PASSWORD" ] || die "Nom d'utilisateur et mot de passe obligatoires."
    setenv SMS_PROVIDER android-gateway
    setenv SMS_GATEWAY_USER "$SMS_GATEWAY_USER"
    setenv SMS_GATEWAY_PASSWORD "$SMS_GATEWAY_PASSWORD"
    ;;
  *)
    echo "Usage : sudo bash $0 twilio | android-gateway" >&2
    exit 2
    ;;
esac

ok "Configuration SMS enregistrée dans .env (fournisseur : $1)"
echo "Redémarrage du service d'identité…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build --no-deps identity-service
ok "Terminé. Testez dans l'application : saisir le numéro d'un bénéficiaire, le SMS doit arriver en quelques secondes."
echo "   En cas d'échec : cd $(pwd) && docker compose logs --tail=50 identity-service | grep -i sms"
