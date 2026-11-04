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

Compte créé par le seed (espace client, Auth.js) : `client@example.com` / `Client123!`.

Le **personnel** (gérant et coiffeurs) se connecte avec [Clerk](https://clerk.com), pas avec un mot de passe stocké
en base : le seed crée leurs fiches (`gerant@maitrecoif.fr`, `julien@maitrecoif.fr`, `lucas@maitrecoif.fr`), mais il
faut un utilisateur Clerk ayant **le même email vérifié** pour entrer dans `/admin` (cf. « Authentification du
personnel » plus bas).

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

- **Visiteur / Client invité** : accueil, services, équipe, réservation, suivi (par code de suivi uniquement) — sans compte.
- **Client** : + historique de ses rendez-vous, avis, modification du profil (`/compte`).
- **Coiffeur** : + son propre planning et ses rendez-vous (`/admin/planning`).
- **Administrateur** (le gérant, qui est aussi un coiffeur) : + gestion de l'équipe, des services et des
  statistiques, validation de tous les rendez-vous.

Le contrôle d'accès est appliqué à la fois côté `proxy.ts` (redirection) et dans chaque route API
(vérification du rôle avant toute lecture/écriture sensible).

## Notifications

Aucun service payant n'est requis.

- **Clients** : email de confirmation, de rappel J-1, de déplacement et d'annulation, via
  [Resend](https://resend.com) (offre gratuite). Sans `RESEND_API_KEY`, les emails sont seulement affichés dans les
  logs du serveur (`[email:stub]`). Pour écrire à n'importe quel client il faut un domaine vérifié chez Resend
  (enregistrements DNS SPF/DKIM) et `RESEND_FROM` sur ce domaine. Un client qui n'a pas renseigné d'email ne reçoit
  rien : son code de suivi s'affiche à l'écran après la réservation.
- **Équipe du salon** : alertes gratuites lors d'une demande de modification ou d'une annulation client, par
  Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) et/ou par email (`SALON_NOTIFY_EMAIL`).
- **WhatsApp et SMS (Twilio)** : le code existe mais reste désactivé tant que les clés sont vides (WhatsApp Business
  est payant). Il n'est pas nécessaire au fonctionnement.

## Anti-bot (Cloudflare Turnstile)

Optionnel : renseignez `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` pour afficher le widget sur le
formulaire de réservation et vérifier le jeton côté serveur. Sans ces clés, seuls le honeypot et le rate limiting
(partagé en base) restent actifs.

## Rappels automatiques

`vercel.json` déclenche chaque jour `/api/cron/rappels` (rappel J-1 par email, et par WhatsApp si activé). Définissez
`CRON_SECRET` dans Vercel (le modèle WhatsApp `rappel_rdv` n'est utile que si vous activez WhatsApp).

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
   mettez l'email réel du gérant sur sa fiche (SQL ou Prisma Studio) pour qu'il corresponde à son compte Clerk.

## Guide rapide du back-office (pour le gérant et son équipe)

- **Connexion** : `/espace-equipe` (Clerk) avec l'adresse email de la fiche équipe. Les clients utilisent `/connexion`.
- **Planning** (`/admin/planning`) : naviguez par jour, terminez ou annulez un rendez-vous. Les réservations
  sont **confirmées automatiquement** dès qu'un créneau est réservé (pas de validation manuelle) ; le statut
  "en attente" ne réapparaît que si un client demande une modification depuis la page de suivi, pour que la
  demande soit relue avant d'être re-confirmée. Le gérant peut basculer entre « Toute l'équipe » (une colonne
  par coiffeur) et « Mon planning ».
- **Nouveau rendez-vous / Déplacer** : depuis le planning, le salon peut saisir une réservation pour un client
  (appel, passage au salon) ou déplacer un rendez-vous existant vers un autre créneau ou coiffeur, y compris hors
  des horaires habituels (case « hors créneaux proposés »). Le client est prévenu par email s'il en a donné un. Une demande de modification faite par le client
  depuis `/suivi` apparaît sur la carte du rendez-vous (le créneau reste bloqué) et est marquée traitée dès que le
  rendez-vous est déplacé.
- **Fermetures** (`/admin/fermetures`, gérant uniquement) : jours fériés, fermetures exceptionnelles de tout le
  salon, congés ou absences d'un coiffeur. Les créneaux de la période disparaissent de la réservation en ligne ;
  les rendez-vous déjà pris ne sont pas annulés automatiquement (un avertissement indique combien sont concernés).
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

## Authentification du personnel (Clerk)

- **Deux systèmes, une règle** : les clients restent sur Auth.js (`/connexion`, `/compte`) ; le personnel utilise Clerk
  (`/espace-equipe`). `auth()` de `lib/auth.ts` renvoie la session du personnel (Clerk) en priorité, sinon celle du
  client : le reste du code n'a pas changé.
- **Les rôles restent en base** : un compte Clerk n'a accès à `/admin` que si son **email vérifié** correspond à un
  membre actif (`COIFFEUR` ou `ADMIN`) de la table `User` (`lib/staff.ts`). Un compte Clerk inconnu est renvoyé sur
  `/espace-equipe/acces-refuse`.
- **Ajouter un membre** : `/admin/equipe` crée la fiche et envoie une invitation Clerk par email ; la personne crée
  son mot de passe via le lien. Aucun mot de passe n'est stocké pour le personnel (Auth.js le refuse).
- **Sans clés Clerk** (preview, tests) : le site public et l'espace client fonctionnent, `/admin` est fermé.
- Configuration du tableau de bord Clerk : voir `.env.example` pour les variables, et les étapes de mise en service
  (instance de production, DNS, claim `email`, inscriptions restreintes).
