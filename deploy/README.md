# Déploiement sur serveur dédié (Docker + nginx + Cloudflare)

Ce dossier contient tout pour héberger Maitre Coif sur un serveur qui héberge déjà une autre application,
**sans que les deux se touchent**, tout en gardant **Vercel + Neon comme solution de secours**.

```
Visiteur ─► Cloudflare ─► nginx (hôte) ─► 127.0.0.1:3101 ─► conteneur « maitrecoif-app » ─► conteneur « maitrecoif-db »
                           │                                  (réseau privé du projet Compose, base non publiée)
                           └─ l'autre application garde ses propres blocs « server » et ses propres conteneurs
```

| Isolation | Comment |
|---|---|
| Réseau | Projet Compose `maitrecoif` : réseau privé dédié. La base n'écoute sur **aucun** port de l'hôte. |
| Processus | Conteneurs nommés `maitrecoif-*`, sans privilèges (`no-new-privileges`, `cap_drop: ALL`), mémoire plafonnée. |
| Données | Volumes Docker dédiés (`pgdata`, `next-cache`), sauvegardes dans `/opt/maitre-coif/backups`. |
| nginx | Un fichier `maitrecoif.conf` qui ne déclare que nos noms de domaine ; rien de global n'est modifié. |
| Port | Le site n'écoute que sur `127.0.0.1:3101` (changez `APP_PORT` si pris). Pas accessible depuis Internet. |

## 1. Ce qui a changé dans le code (déjà fait)

- `Dockerfile` : image de production (Next.js « standalone », utilisateur non-root, sonde de santé) + image de migrations.
- `next.config.mjs` : `output: 'standalone'` **seulement** quand `BUILD_STANDALONE=1` (Vercel n'est pas affecté).
- `app/layout.tsx` : avec `RENDER_DYNAMIC=1`, aucune page n'est pré-rendue au build (le build n'a pas accès à la base :
  sans cela, le pied de page et l'accueil resteraient figés avec des données vides). Sans la variable (Vercel) : comportement d'origine.
  `@vercel/analytics` n'est chargé que sur Vercel.
- `lib/rate-limit.ts` : l'adresse du visiteur vient de `X-Real-IP` posé par nginx ; l'en-tête `x-vercel-forwarded-for`
  n'est cru que sur Vercel (sinon un visiteur pourrait le falsifier pour contourner les limites anti-abus).
- `app/api/health` : sonde de santé (site + base).
- `.github/workflows/deploy.yml` : tests, image, publication GHCR, déploiement SSH.
- Vérifié localement : la construction « standalone » réussit **sans base ni secrets**, embarque le moteur Prisma et `sharp`,
  et le serveur démarre. L'image Docker elle-même n'a pas pu être construite sur ce poste (Docker Desktop absent) :
  le premier passage du workflow sera sa première construction. Voir « Premier déploiement ».

## 2. Préparer le serveur (une seule fois)

Connectez-vous en administrateur et vérifiez d'abord ce qui existe :

```bash
docker --version && docker compose version     # Docker + plugin Compose
sudo ss -ltnp | grep -E ':(80|443|3101)\b'     # ports déjà utilisés (3101 doit être libre, sinon changer APP_PORT)
sudo nginx -v && ls /etc/nginx/sites-enabled   # nginx et sites existants (ne rien modifier de l'autre application)
free -h && df -h /                              # prévoir ~1,5 Go de RAM libre et ~5 Go de disque
```

Utilisateur de déploiement et dossiers :

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy                  # accès à Docker (équivaut à un accès root sur ce serveur : gardez la clé secrète)
sudo mkdir -p /opt/maitre-coif/backups && sudo chown -R deploy:deploy /opt/maitre-coif
```

Clé SSH dédiée au déploiement (sur **votre poste**, pas sur le serveur) :

```bash
ssh-keygen -t ed25519 -f maitrecoif-deploy -C "github-actions maitrecoif" -N ""
ssh-copy-id -i maitrecoif-deploy.pub deploy@IP_DU_SERVEUR      # ou ajoutez la ligne dans ~deploy/.ssh/authorized_keys
ssh-keyscan -p 22 IP_DU_SERVEUR                                 # → valeur du secret SSH_KNOWN_HOSTS
```

Envoyez ce dossier `deploy/` sur le serveur (une fois ; les déploiements suivants ne renvoient que le compose et les scripts) :

```bash
scp -r deploy deploy@IP_DU_SERVEUR:/opt/maitre-coif/install
```

Fichiers de configuration (sur le serveur, en tant que `deploy`) :

```bash
cd /opt/maitre-coif
cp install/env.example .env && cp install/app.env.example app.env
# .env : variables de Docker Compose        → éditez POSTGRES_PASSWORD (openssl rand -hex 24), IMAGE (minuscules), APP_PORT
# app.env : variables du site               → AUTH_SECRET, clés Clerk, Resend, CRON_SECRET... : les MÊMES valeurs que sur Vercel
chmod 600 .env app.env
```

> `app.env` : `DATABASE_URL` et `DIRECT_URL` pointent vers `db:5432` (le conteneur), avec le mot de passe de `.env`.
> Gardez le **même `AUTH_SECRET`** que Vercel : les sessions des clients restent valides lors de la bascule.

## 3. Secrets et variables GitHub

Dépôt → *Settings → Environments → New environment* : créez **`production`** (vous pouvez y exiger une approbation manuelle).

**Secrets** (*Settings → Secrets and variables → Actions → Secrets*) :

| Nom | Valeur |
|---|---|
| `SSH_HOST` | IP ou nom du serveur |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | (facultatif) port SSH si différent de 22 |
| `SSH_PRIVATE_KEY` | contenu du fichier `maitrecoif-deploy` (clé privée) |
| `SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan` ci-dessus |

**Variables** (onglet *Variables*, valeurs publiques inscrites dans le code du site) :
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SALON_HOST` (ex. `salon.maitrecoif.com`),
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_UI_HOST`, `NEXT_PUBLIC_SALON_MAP_QUERY`
— reprenez celles de Vercel (celles que vous n'utilisez pas peuvent rester vides).

Le jeton `GITHUB_TOKEN` (automatique) publie l'image sur GHCR et sert au serveur à la télécharger, le temps du déploiement.

## 4. nginx et Cloudflare

```bash
sudo cp /opt/maitre-coif/install/nginx/cloudflare-realip.conf /etc/nginx/snippets/cloudflare-realip.conf
sudo cp /opt/maitre-coif/install/nginx/maitrecoif.conf /etc/nginx/sites-available/maitrecoif.conf     # adaptez les noms de domaine et le port
sudo ln -s /etc/nginx/sites-available/maitrecoif.conf /etc/nginx/sites-enabled/
```

**Certificat d'origine** : Cloudflare → *SSL/TLS → Origin Server → Create Certificate* (15 ans, `maitrecoif.com` + `*.maitrecoif.com`).
Collez le certificat et la clé sur le serveur :

```bash
sudo mkdir -p /etc/ssl/maitrecoif
sudo nano /etc/ssl/maitrecoif/origin.pem    # certificat
sudo nano /etc/ssl/maitrecoif/origin.key    # clé privée
sudo chmod 600 /etc/ssl/maitrecoif/origin.key
sudo nginx -t && sudo systemctl reload nginx
```

Puis, côté Cloudflare : *SSL/TLS → Overview →* mode **Full (strict)**. **Ne changez pas encore le DNS** (voir §6).

## 5. Tâches planifiées (rappels J-1, sauvegardes)

```bash
sudo cp /opt/maitre-coif/install/systemd/maitrecoif-*.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maitrecoif-rappels.timer maitrecoif-sauvegarde.timer
systemctl list-timers 'maitrecoif-*'
```

Le minuteur de rappels remplace le « Vercel Cron » (16:00 UTC chaque jour, comme avant). La sauvegarde de la base a lieu à 03:00 UTC,
14 copies conservées dans `/opt/maitre-coif/backups`. **Copiez ce dossier hors du serveur** (rclone, rsync vers un autre disque ou un stockage
distant) : sur Neon gratuit vous n'aviez que 6 h d'historique, ici la sauvegarde est la vôtre.

## 6. Migrer la base de Neon vers le serveur

À faire à **blanc d'abord** (répétition), puis une dernière fois pendant la bascule.

```bash
cd /opt/maitre-coif
docker compose up -d db                                  # crée la base vide (volume pgdata)

# Export de Neon (connexion DIRECTE, sans « -pooler »). Le client pg_dump doit être en version 18 comme Neon.
read -rs -p "DIRECT_URL de Neon : " NEON_URL; echo
docker run --rm postgres:18-alpine pg_dump "$NEON_URL" -Fc --no-owner --no-acl > backups/neon.dump
unset NEON_URL

./scripts/restore-db.sh backups/neon.dump                # répondez « oui »
```

Vérifications avant d'aller plus loin (comparez avec Neon) :

```bash
docker exec maitrecoif-db psql -U maitrecoif -d maitrecoif -c \
  'SELECT (SELECT count(*) FROM "User") users, (SELECT count(*) FROM "RendezVous") rdv, (SELECT count(*) FROM "Service") services;'
```

> L'export contient aussi la table des migrations Prisma : le premier déploiement n'appliquera que les migrations manquantes.
> Restaurez **avant** le premier déploiement.

## 7. Premier déploiement et essai à blanc

1. Poussez sur `main` (ou *Actions → Déploiement (serveur) → Run workflow*). Surveillez les trois étapes : tests, image, déploiement.
   Si la construction de l'image échoue, la sortie du workflow indique l'étape : c'est le moment de corriger, rien n'est en ligne.
2. Sur le serveur : `docker ps` (les conteneurs `maitrecoif-app` et `maitrecoif-db` doivent être « healthy »), puis
   `curl -s http://127.0.0.1:3101/api/health` → `{"ok":true}`.
3. **Essai sans toucher au DNS** — depuis votre poste, forcez le domaine vers le serveur :

   ```bash
   curl -sk --resolve maitrecoif.com:443:IP_DU_SERVEUR https://maitrecoif.com/api/health
   ```
   Pour voir le site dans le navigateur, ajoutez temporairement `IP_DU_SERVEUR maitrecoif.com salon.maitrecoif.com` au fichier hosts
   de votre poste (et retirez-le ensuite). Testez : accueil, réservation d'un service **et d'un pack**, connexion du personnel (Clerk),
   boutique, envoi d'email.

## 8. Bascule (jour J)

1. **Geler** les écritures côté Vercel : prévenez le salon ; faites l'export Neon (§6) et la restauration finale.
2. **Désactiver la tâche planifiée de Vercel** (Vercel → projet → *Settings → Cron Jobs → Disable*, ou supprimer la variable `CRON_SECRET`
   de Vercel) : sinon, après la bascule, Vercel enverrait des rappels à partir de l'ancienne base. 
3. Cloudflare → DNS : faites pointer `maitrecoif.com`, `www` et `salon` (enregistrements **A**, proxy activé) vers l'IP du serveur.
   Notez avant l'ancienne valeur (CNAME Vercel) pour pouvoir revenir.
4. Vérifiez : accueil, réservation, espace salon (`salon.maitrecoif.com`), une alerte/email de test, `systemctl list-timers`.

Clerk, Resend et Auth.js n'ont rien à reconfigurer : le domaine est le même et les clés sont identiques.

## 9. Plan de secours : revenir à Vercel + Neon

1. Mettez le site en pause côté serveur si besoin : `docker compose stop app`.
2. **Si des données ont été créées depuis la bascule** (rendez-vous, commandes), rapatriez-les dans Neon avant de rebasculer :
   `./scripts/backup-db.sh retour-vercel`, puis restaurez ce `.dump` dans Neon avec un `pg_restore --clean --if-exists --no-owner --no-acl -d "$DIRECT_URL"`
   (Neon *Free* garde 6 h d'historique seulement : faites d'abord un export de Neon par précaution).
3. Réactivez les *Cron Jobs* de Vercel (ou remettez `CRON_SECRET`), et **désactivez** `maitrecoif-rappels.timer` sur le serveur
   (`sudo systemctl disable --now maitrecoif-rappels.timer`) : un seul des deux doit envoyer les rappels.
4. Cloudflare → DNS : remettez l'ancien enregistrement (Vercel).

Tant que vous ne souhaitez pas supprimer la solution de secours, **ne coupez ni le projet Vercel ni la base Neon** et ne les laissez pas
accepter de nouvelles écritures en parallèle (deux bases qui divergent).

## 10. Au quotidien

| Besoin | Commande (sur le serveur, dans `/opt/maitre-coif`) |
|---|---|
| Déployer | simplement pousser sur `main` |
| Journaux du site | `docker logs -f --tail 100 maitrecoif-app` · nginx : `/var/log/nginx/maitrecoif.*.log` |
| État | `docker compose ps` · `curl -s http://127.0.0.1:3101/api/health` |
| Retour à une version | `./scripts/deploy.sh <tag>` (tags = 12 premiers caractères du commit, visibles sur GHCR) |
| Sauvegarde manuelle | `./scripts/backup-db.sh manuelle` |
| Restaurer | `./scripts/restore-db.sh backups/<fichier>.dump` |
| Console SQL | `docker exec -it maitrecoif-db psql -U maitrecoif -d maitrecoif` (correction d'une fiche « Équipe », etc.) |
| Tâche quotidienne à la main | `./scripts/rappels.sh` |

Les migrations Prisma sont appliquées à chaque déploiement, **après** une sauvegarde automatique. Si le nouveau site ne devient pas « healthy »,
le script remet la version précédente (la base, elle, reste migrée : écrivez des migrations compatibles avec la version précédente).
