# Déploiement sur serveur dédié (Docker + nginx + Cloudflare)

Ce dossier contient tout pour héberger Maitre Coif sur un serveur qui héberge déjà d'autres applications,
**sans que celles-ci se touchent**.

```
Visiteur ─► Cloudflare ─► nginx (hôte) ─► 127.0.0.1:3101 ─► conteneur « maitrecoif-app » ─► conteneur « maitrecoif-db »
                           │                                  (réseau privé du projet Compose, base non publiée)
                           └─ les autres applications gardent leurs propres blocs « server » et leurs propres conteneurs
```

| Isolation | Comment |
|---|---|
| Réseau | Projet Compose `maitrecoif` : réseau privé dédié. La base n'écoute sur **aucun** port de l'hôte. |
| Processus | Conteneurs nommés `maitrecoif-*`, sans privilèges (`no-new-privileges`, `cap_drop: ALL`). |
| Ressources | Plafonds : **2 CPU et 4 Go** au total (site 1,5 CPU / 3 Go, base 0,5 CPU / 1 Go), avec mémoire réservée en priorité. |
| Données | Volumes Docker dédiés (`pgdata`, `next-cache`), sauvegardes dans `/opt/maitre-coif/backups`. |
| Journaux | Docker : 3 fichiers de 5 Mo par conteneur au plus. PostgreSQL : avertissements et erreurs seulement. nginx : erreurs (4xx, 5xx) et requêtes de plus d'une seconde seulement. |
| nginx | Un fichier `maitrecoif.conf` qui ne déclare que nos noms de domaine ; rien de global n'est modifié. |
| Port | Le site n'écoute que sur `127.0.0.1:3101` (changez `APP_PORT` si pris). Pas accessible depuis Internet. |

## 1. Ce que contient le code

- `Dockerfile` : image de production (Next.js « standalone », utilisateur non-root, sonde de santé) + image de migrations.
- `next.config.mjs` : `output: 'standalone'` quand `BUILD_STANDALONE=1` (défini dans le Dockerfile).
- `app/layout.tsx` : avec `RENDER_DYNAMIC=1`, aucune page n'est pré-rendue au build (le build n'a pas accès à la base :
  sans cela, le pied de page et l'accueil resteraient figés avec des données vides).
- `lib/rate-limit.ts` : l'adresse du visiteur vient de `X-Real-IP` posé par nginx.
- `app/api/health` : sonde de santé (site + base).
- `.github/workflows/deploy.yml` : tests, image, publication GHCR, déploiement SSH.

## 2. Préparer le serveur (une seule fois)

Connectez-vous en administrateur et vérifiez d'abord ce qui existe :

```bash
docker --version && docker compose version     # Docker + plugin Compose
sudo ss -ltnp | grep -E ':(80|443|3101)\b'     # ports déjà utilisés (3101 doit être libre, sinon changer APP_PORT)
sudo nginx -v && ls /etc/nginx/sites-enabled   # nginx et sites existants (ne rien modifier des autres applications)
free -h && df -h /                              # prévoir 4 Go de RAM disponibles et ~5 Go de disque
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
# app.env : variables du site               → AUTH_SECRET, clés Clerk, Resend, Turnstile, CRON_SECRET...
chmod 600 .env app.env
```

> `app.env` : `DATABASE_URL` et `DIRECT_URL` pointent vers `db:5432` (le conteneur), avec le mot de passe de `.env`.
> `RESEND_FROM` doit utiliser le domaine **vérifié chez Resend** (ex. `reservation@maitrecoif.com`), sinon aucun email ne part.
> Les clés `NEXT_PUBLIC_*` sont déjà inscrites dans l'image : si vous les répétez dans `app.env`, elles doivent être identiques.

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
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (clé de **site** du widget Turnstile, jamais la clé secrète), `NEXT_PUBLIC_POSTHOG_KEY`,
`NEXT_PUBLIC_POSTHOG_UI_HOST`, `NEXT_PUBLIC_SALON_MAP_QUERY`. Celles que vous n'utilisez pas peuvent rester vides.

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

Côté Cloudflare : *SSL/TLS → Overview →* mode **Full (strict)**, et dans *DNS*, enregistrements **A** (proxy activé) pour
`maitrecoif.com`, `www` et `salon` vers l'IP du serveur. Les enregistrements de Clerk et de Resend restent en « DNS only ».

## 5. Tâches planifiées et sauvegardes

```bash
sudo cp /opt/maitre-coif/install/systemd/maitrecoif-*.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maitrecoif-rappels.timer maitrecoif-sauvegarde.timer
systemctl list-timers 'maitrecoif-*'
```

Le minuteur de rappels envoie les rappels J-1 chaque jour à 16:00 UTC. La sauvegarde de la base a lieu à 03:00 UTC,
14 copies conservées dans `/opt/maitre-coif/backups`.

**Ces sauvegardes sont sur le même serveur que la base** : si le serveur est perdu, elles le sont aussi. Copiez-les régulièrement **hors
du serveur** (votre poste, un autre serveur ou un stockage distant) :

```bash
# depuis votre poste (PowerShell) : copie de la dernière sauvegarde
scp deploy@IP_DU_SERVEUR:/opt/maitre-coif/backups/$(ssh deploy@IP_DU_SERVEUR "ls -1t /opt/maitre-coif/backups | head -1") .
```

## 6. Déploiement

1. Poussez sur `main` (ou *Actions → Déploiement (serveur) → Run workflow*). Surveillez les trois étapes : tests, image, déploiement.
2. Sur le serveur : `docker ps` (les conteneurs `maitrecoif-app` et `maitrecoif-db` doivent être « healthy »), puis
   `curl -s http://127.0.0.1:3101/api/health` → `{"ok":true}`.

Les migrations Prisma sont appliquées à chaque déploiement, **après** une sauvegarde automatique. Si le nouveau site ne devient pas
« healthy », le script remet la version précédente (la base, elle, reste migrée : écrivez des migrations compatibles avec la version précédente).

## 7. Au quotidien

| Besoin | Commande (sur le serveur, dans `/opt/maitre-coif`) |
|---|---|
| Déployer | simplement pousser sur `main` |
| Journaux du site | `docker logs -f --tail 100 maitrecoif-app` · nginx : `/var/log/nginx/maitrecoif.*.log` |
| État | `docker compose ps` · `curl -s http://127.0.0.1:3101/api/health` |
| Consommation | `docker stats --no-stream` |
| Retour à une version | `./scripts/deploy.sh <tag>` (tags = 12 premiers caractères du commit, visibles sur GHCR) |
| Sauvegarde manuelle | `./scripts/backup-db.sh manuelle` |
| Console SQL | `docker exec -it maitrecoif-db psql -U maitrecoif -d maitrecoif` (correction d'une fiche « Équipe », etc.) |
| Tâche quotidienne à la main | `./scripts/rappels.sh` |

**Ne jamais vider ni restaurer la base de production à la légère** : elle contient les rendez-vous réels. Toute opération destructive
se fait après une sauvegarde manuelle et, pour un test, en ciblant une seule ligne par son code de suivi.

## 8. Reprise après sinistre (serveur perdu ou à remplacer)

1. Préparez le nouveau serveur comme aux §2 à §5.
2. Copiez une sauvegarde récente (`.dump`) dans `/opt/maitre-coif/backups`.
3. `docker compose up -d db`, puis `./scripts/restore-db.sh backups/<fichier>.dump` (réponse « oui »).
4. Poussez sur `main` (ou relancez le workflow) pour déployer le site, puis dans Cloudflare faites pointer les enregistrements **A**
   vers la nouvelle IP.
