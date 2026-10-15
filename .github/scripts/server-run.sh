#!/usr/bin/env bash
# Runs, as root on the production server, the bash script read on standard input (over SSH).
# Repository secrets: SERVER_HOST (IP or domain), SERVER_SSH_KEY (private key, e.g. content of the EC2 .pem),
# SERVER_USER (optional, default ubuntu). Without them the server update is skipped with a warning.
set -euo pipefail
if [ -z "${SERVER_HOST:-}" ] || [ -z "${SERVER_SSH_KEY:-}" ]; then
  echo "::warning::Secrets SERVER_HOST et SERVER_SSH_KEY absents (Settings → Secrets and variables → Actions) : serveur non mis à jour."
  exit 0
fi
key="$(mktemp)"
trap 'rm -f "$key"' EXIT
printf '%s\n' "$SERVER_SSH_KEY" | tr -d '\r' > "$key"
chmod 600 "$key"
ssh -i "$key" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o ServerAliveInterval=30 \
  "${SERVER_USER:-ubuntu}@$SERVER_HOST" 'sudo bash -s'
