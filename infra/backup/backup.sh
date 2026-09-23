#!/usr/bin/env bash
# Daily encrypted PostgreSQL backup with 30-day retention (cahier des charges §3).
# Example cron (VPS): 30 2 * * * /opt/damascino/backup.sh >> /var/log/damascino-backup.log 2>&1
# Required: PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD BACKUP_PASSPHRASE; optional BACKUP_DIR, RETENTION_DAYS.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/damascino}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(TZ=Africa/Tunis date +%Y-%m-%d_%H%M)"
TARGET="$BACKUP_DIR/damascino_$STAMP.sql.gz.gpg"

mkdir -p "$BACKUP_DIR"
pg_dump --no-owner --format=plain | gzip -9 \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$TARGET"
find "$BACKUP_DIR" -name 'damascino_*.sql.gz.gpg' -mtime +"$RETENTION_DAYS" -delete
echo "$(date -Is) backup written to $TARGET"

# Restore (quarterly test):
#   gpg --decrypt damascino_<date>.sql.gz.gpg | gunzip | psql
