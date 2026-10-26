#!/usr/bin/env bash
# Resets the super-administrator "admin": initial password back (ADMIN_PASSWORD of .env, Damascino2026! by default),
# account unlocked and reactivated, password change forced at the next login. Data is kept.
#   bash infra/reset-admin.sh            (Codespace, PC)
#   sudo bash infra/reset-admin.sh       (production server installed with infra/vps/deploy.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose)
# production server (deploy.sh writes DOMAIN in .env and runs with docker-compose.prod.yml)
if [ -f .env ] && grep -q '^DOMAIN=.\+' .env; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
fi
PASSWORD="${ADMIN_PASSWORD:-}"
if [ -z "$PASSWORD" ] && [ -f .env ]; then
  PASSWORD="$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2- || true)"
fi
PASSWORD="${PASSWORD:-Damascino2026!}"

echo "▶ Réinitialisation du compte admin…"
ADMIN_RESET=true "${COMPOSE[@]}" up -d --no-build --force-recreate --no-deps identity-service
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" logs identity-service 2>&1 | grep -q "reset to the initial password"; then
    # back to normal: a later restart must not reset the password again
    "${COMPOSE[@]}" up -d --force-recreate --no-deps identity-service >/dev/null 2>&1
    echo "✅ Compte admin réinitialisé : identifiant admin, mot de passe $PASSWORD (à changer à la connexion)."
    exit 0
  fi
  sleep 3
done
echo "⚠ Réinitialisation non confirmée. Journaux :"
"${COMPOSE[@]}" logs --tail=30 identity-service
exit 1
