#!/usr/bin/env bash
# Tâche quotidienne (remplace le « Vercel Cron ») : rappels de rendez-vous J-1, expiration des réservations
# de produits. Elle s'exécute DANS le conteneur du site, qui détient déjà CRON_SECRET : aucun secret sur l'hôte.
set -euo pipefail

docker exec maitrecoif-app node -e "
fetch('http://127.0.0.1:3000/api/cron/rappels', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })
  .then(async (r) => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) })
  .catch((e) => { console.error(e); process.exit(1) })
"
