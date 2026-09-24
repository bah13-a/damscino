#!/usr/bin/env bash
# Starts the whole stack in a GitHub Codespace and publishes the application on a public HTTPS URL.
set -uo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CODESPACE_NAME:-}" ]; then
  export PUBLIC_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi

echo "▶ Démarrage de Damascino Privilèges (la première fois : 10 à 15 minutes de compilation)…"
docker compose up -d --build

echo "▶ Attente de l'application…"
for _ in $(seq 1 120); do
  curl -sf http://localhost:3000/ >/dev/null && curl -sf http://localhost:8080/actuator/health >/dev/null && break
  sleep 5
done

# public URL so that phones can open it without a GitHub account (camera needs HTTPS: provided by Codespaces)
if [ -n "${CODESPACE_NAME:-}" ]; then
  gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
    || echo "ℹ Rendez le port 3000 public : onglet PORTS → clic droit → Port Visibility → Public"
  echo
  echo "✅ Application : ${PUBLIC_URL}"
  echo "   Administration : ${PUBLIC_URL}/admin/connexion  (admin / Damascino2026! — changement imposé)"
fi
