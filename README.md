# Maitre Coif — Plateforme de réservation

Site vitrine, réservation en ligne, espace client et back-office administrateur pour le salon Maitre
Coif, conforme au [cahier des charges](./Cahier_des_charges_Maitre_Coif.pdf).

## Stack technique

- **Frontend** : Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (`@base-ui/react`)
- **Backend** : API routes Next.js
- **Base de données** : PostgreSQL + Prisma ORM
- **Authentification** : Auth.js v5 (NextAuth), credentials + JWT, `bcryptjs` pour le hachage des mots de passe
- **Notifications** : Resend (email) et Twilio (SMS, optionnel) — désactivés par défaut, les envois sont
  simplement loggés en console tant qu'aucune clé API n'est configurée

## Démarrage en local

### 1. Dépendances

```bash
pnpm install
```

### 2. Base de données

Deux options :

**a) Docker (le plus simple)** — un `docker-compose.yml` est fourni :

```bash
docker compose up -d
```

Cela démarre un Postgres local sur `localhost:5433` (le port 5432 est volontairement évité s'il est déjà
utilisé par un autre service sur votre machine — adaptez `docker-compose.yml` et `.env` si besoin).

**b) Neon / Supabase (recommandé pour la production)** — créez un projet gratuit et récupérez l'URL de
connexion PostgreSQL.

### 3. Variables d'environnement

Copiez `.env.example` vers `.env` et renseignez au minimum `DATABASE_URL` et `AUTH_SECRET` (générez ce
dernier avec `npx auth secret` ou `openssl rand -base64 32`).

### 4. Migrations et données de démonstration

```bash
pnpm db:migrate   # applique le schéma Prisma
pnpm db:seed      # crée un gérant, deux coiffeurs, des services et des rendez-vous d'exemple
```

Comptes créés par le seed :

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur (gérant) | `gerant@maitrecoif.fr` | `Gerant123!` |
| Coiffeur | `julien@maitrecoif.fr` | `Coiffeur123!` |
| Coiffeur | `lucas@maitrecoif.fr` | `Coiffeur123!` |
| Client (compte) | `client@example.com` | `Client123!` |

### 5. Lancer le serveur de développement

```bash
pnpm dev
```

Le site est accessible sur [http://localhost:3000](http://localhost:3000) (ou le premier port libre si
3000 est déjà pris).

## Structure du projet

```
app/(site)/       Pages publiques et espace client (accueil, équipe, services,
                   réservation, suivi, connexion, inscription, mon compte)
app/admin/         Back-office (planning, équipe, services, statistiques)
app/api/           Routes API (réservation, disponibilités, auth, admin...)
components/        Composants React (site/, reservation/, auth/, compte/, admin/, ui/)
lib/               Logique métier partagée (auth, slots, notifications, statistiques...)
prisma/            Schéma de base de données et script de seed
proxy.ts           Middleware de contrôle d'accès (RBAC) — convention Next.js 16
```

## Modèle d'accès (RBAC)

- **Visiteur / Client invité** : accueil, services, équipe, réservation, suivi — sans compte.
- **Client** : + historique de ses rendez-vous, avis, modification du profil (`/compte`).
- **Coiffeur** : + son propre planning et ses rendez-vous (`/admin/planning`).
- **Administrateur** (le gérant, qui est aussi un coiffeur) : + gestion de l'équipe, des services et des
  statistiques, validation de tous les rendez-vous.

Le contrôle d'accès est appliqué à la fois côté `proxy.ts` (redirection) et dans chaque route API
(vérification du rôle avant toute lecture/écriture sensible).

## Notifications

Par défaut, les emails de confirmation et de réinitialisation de mot de passe sont simplement affichés
dans les logs du serveur (`[email:stub] ...`). Pour activer l'envoi réel, renseignez `RESEND_API_KEY` et
`RESEND_FROM` dans `.env`. Le SMS (Twilio) suit le même principe et reste optionnel.

## Tests et audit d'accessibilité

```bash
pnpm test    # tests unitaires (Vitest) + un test d'intégration contre la base locale
pnpm a11y    # audit WCAG 2.1 A/AA (axe-core) sur les pages publiques et le back-office
```

Le test d'intégration (`tests/booking-overlap.test.ts`) et l'audit d'accessibilité nécessitent que la base
locale (`docker compose up -d`) et le serveur de dev (`pnpm dev`) tournent — l'audit prend l'URL du serveur
en argument (`pnpm a11y http://localhost:3000`, `http://localhost:3001` par défaut).

## Déploiement (Vercel + Neon/Supabase)

1. Créez une base PostgreSQL managée (Neon ou Supabase) et récupérez son `DATABASE_URL`.
2. Poussez le projet sur GitHub, importez-le sur [Vercel](https://vercel.com).
3. Renseignez les variables d'environnement de `.env.example` dans les paramètres du projet Vercel
   (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` = URL de production, et éventuellement les clés Resend/Twilio).
4. Exécutez les migrations sur la base de production : `DATABASE_URL=... pnpm prisma migrate deploy`.
5. (Optionnel) Lancez `pnpm db:seed` une première fois pour créer le compte administrateur initial, puis
   changez son mot de passe depuis `/connexion` → back-office → gestion de l'équipe.

## Guide rapide du back-office (pour le gérant et son équipe)

- **Connexion** : `/connexion` avec l'email et le mot de passe du compte coiffeur/administrateur.
- **Planning** (`/admin/planning`) : naviguez par jour, terminez ou annulez un rendez-vous. Les réservations
  sont **confirmées automatiquement** dès qu'un créneau est réservé (pas de validation manuelle) ; le statut
  "en attente" ne réapparaît que si un client demande une modification depuis la page de suivi, pour que la
  demande soit relue avant d'être re-confirmée. Le gérant peut basculer entre « Toute l'équipe » (une colonne
  par coiffeur) et « Mon planning ».
- **Équipe** (`/admin/equipe`, gérant uniquement) : ajoutez un coiffeur, modifiez ses informations et ses
  disponibilités hebdomadaires, ou désactivez son compte (l'historique de ses rendez-vous est conservé).
- **Services** (`/admin/services`, gérant uniquement) : créez, modifiez, activez ou désactivez une
  prestation (nom, prix, durée, catégorie).
- **Statistiques** (`/admin/statistiques`, gérant uniquement) : chiffre d'affaires, nombre de rendez-vous
  et taux de remplissage, globaux et par coiffeur, filtrables par période.

## Commandes utiles

```bash
pnpm dev          # serveur de développement
pnpm build        # build de production
pnpm start        # démarre le build de production
pnpm db:migrate   # applique une nouvelle migration Prisma
pnpm db:studio    # interface graphique pour explorer la base de données
pnpm db:seed      # réinitialise les données de démonstration
```
