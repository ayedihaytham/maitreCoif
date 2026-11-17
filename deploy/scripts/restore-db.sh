#!/usr/bin/env bash
# Restaure une sauvegarde (.dump) dans la base du serveur. ATTENTION : remplace toutes les données actuelles.
#   ./scripts/restore-db.sh backups/maitrecoif-....dump
set -euo pipefail

cd "$(dirname "$0")/.."
FICHIER="${1:?usage : restore-db.sh <fichier.dump>}"
[ -f "$FICHIER" ] || { echo "Fichier introuvable : $FICHIER" >&2; exit 1; }

read -r -p "Remplacer TOUTES les données de la base par $FICHIER ? Tapez « oui » : " REPONSE
[ "$REPONSE" = "oui" ] || { echo "Annulé."; exit 1; }

docker compose up -d db
echo "==> Arrêt du site pendant la restauration"
docker compose stop app || true

docker exec -i maitrecoif-db pg_restore -U maitrecoif -d maitrecoif --clean --if-exists --no-owner --no-acl < "$FICHIER" \
  || echo "(pg_restore a signalé des avertissements : lisez-les )"
echo "==> Restauration terminée. Relancez le site :  TAG=\$(cat .tag-courant) docker compose up -d app"
