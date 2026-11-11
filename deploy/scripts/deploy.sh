#!/usr/bin/env bash
# Déploie une version de Maitre Coif sur ce serveur. Lancé par GitHub Actions (ou à la main) :
#   ./scripts/deploy.sh <tag-de-l-image> [utilisateur-ghcr]     (jeton GHCR éventuel sur l'entrée standard)
#
# Étapes : connexion au registre -> sauvegarde de la base -> téléchargement -> migrations -> redémarrage du site
# -> attente de la sonde de santé. Si le nouveau site ne devient pas sain, on revient à la version précédente.
# Les migrations Prisma sont conçues pour ne pas casser la version précédente (ajouts, pas de suppression brutale).
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:?usage : deploy.sh <tag> [utilisateur-ghcr]}"
REGISTRE_UTILISATEUR="${2:-}"
export TAG

# IMAGE, APP_PORT... (fichier .env de Compose)
# shellcheck disable=SC1091
set -a; . ./.env; set +a

# Connexion à GHCR avec le jeton fourni par le workflow (jamais écrit dans la ligne de commande).
if [ -n "$REGISTRE_UTILISATEUR" ] && [ ! -t 0 ]; then
  IFS= read -r JETON || true
  if [ -n "${JETON:-}" ]; then
    printf '%s' "$JETON" | docker login "${IMAGE%%/*}" -u "$REGISTRE_UTILISATEUR" --password-stdin
  fi
fi

PRECEDENT="$(cat .tag-courant 2>/dev/null || true)"

echo "==> Démarrage de la base (si besoin)"
# --wait : on ne continue que lorsque la base répond (elle peut venir d'être recréée : la sauvegarde qui suit échouerait sinon).
docker compose up -d --wait --wait-timeout 120 db

if [ -n "$PRECEDENT" ]; then
  echo "==> Sauvegarde avant migration"
  ./scripts/backup-db.sh avant-deploiement
fi

echo "==> Téléchargement de l'image $TAG"
docker compose pull app migrate

echo "==> Migrations de la base"
docker compose --profile tools run --rm migrate

echo "==> Démarrage du site"
docker compose up -d --remove-orphans app

echo "==> Attente de la sonde de santé"
for _ in $(seq 1 40); do
  etat="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' maitrecoif-app 2>/dev/null || echo absent)"
  if [ "$etat" = "healthy" ]; then
    echo "$TAG" > .tag-courant
    echo "==> Déploiement réussi : $TAG"
    # Nettoyage : on garde les 3 dernières images du site (retour arrière rapide), pas celles des autres applications.
    docker images --format '{{.Repository}}:{{.Tag}}' | grep -F "$IMAGE:" | grep -v -- '-migrate$' | tail -n +4 | xargs -r docker rmi 2>/dev/null || true
    exit 0
  fi
  sleep 3
done

echo "!! Le site n'est pas devenu sain." >&2
docker logs --tail 60 maitrecoif-app >&2 || true
if [ -n "$PRECEDENT" ]; then
  echo "!! Retour à la version précédente : $PRECEDENT" >&2
  TAG="$PRECEDENT" docker compose up -d app
fi
exit 1
