#!/usr/bin/env bash
# Sauvegarde de la base dans /opt/maitre-coif/backups (format pg_dump « custom », compressé).
#   ./scripts/backup-db.sh [étiquette]      -> backups/maitrecoif-AAAAMMJJ-HHMMSS-<étiquette>.dump
# Garde les 14 dernières. Copiez le dossier hors du serveur (rclone, rsync...) pour survivre à une panne du disque.
set -euo pipefail

cd "$(dirname "$0")/.."
ETIQUETTE="${1:-quotidienne}"
mkdir -p backups
FICHIER="backups/maitrecoif-$(date -u +%Y%m%d-%H%M%S)-${ETIQUETTE}.dump"

docker exec maitrecoif-db pg_dump -U maitrecoif -d maitrecoif -Fc --no-owner --no-acl > "$FICHIER.tmp"
mv "$FICHIER.tmp" "$FICHIER"
echo "Sauvegarde : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

ls -1t backups/maitrecoif-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
