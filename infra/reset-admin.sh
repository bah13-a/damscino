#!/usr/bin/env bash
# Resets the super-administrator "admin": initial password back (Damascino2026!, or ADMIN_PASSWORD), account
# unlocked and reactivated, password change forced at the next login. Data is kept.
#   bash infra/reset-admin.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Réinitialisation du compte admin…"
ADMIN_RESET=true docker compose up -d --build --force-recreate --no-deps identity-service
for _ in $(seq 1 60); do
  if docker compose logs identity-service 2>&1 | grep -q "reset to the initial password"; then
    # back to normal: a later restart must not reset the password again
    docker compose up -d --force-recreate --no-deps identity-service >/dev/null 2>&1
    echo "✅ Compte admin réinitialisé : identifiant admin, mot de passe ${ADMIN_PASSWORD:-Damascino2026!} (à changer à la connexion)."
    exit 0
  fi
  sleep 3
done
echo "⚠ Réinitialisation non confirmée. Journaux :"
docker compose logs --tail=30 identity-service
exit 1
