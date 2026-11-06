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

- **Clients** : emails mis en page aux couleurs du salon, via [Resend](https://resend.com) (offre gratuite) :
  confirmation avec **QR code** et bouton « Suivre mon rendez-vous » (le QR mène à `/suivi?code=…`, la page de
  suivi), changement de statut décidé par le salon (confirmé, terminé, annulé), passage automatique en « Terminé »,
  rappel J-1, déplacement et annulation. Sans `RESEND_API_KEY`, les emails sont seulement affichés dans les
  logs du serveur (`[email:stub]`). Pour écrire à n'importe quel client il faut un domaine vérifié chez Resend
  (enregistrements DNS SPF/DKIM) et `RESEND_FROM` sur ce domaine. Un client qui n'a pas renseigné d'email ne reçoit
  rien : son code de suivi s'affiche à l'écran après la réservation.
- **Coiffeur choisi par le client** : il reçoit un email quand le client annule son rendez-vous ou demande à le
  modifier (à l'adresse de sa fiche dans « Équipe » ; rien n'est envoyé à un coiffeur désactivé).
- **Équipe du salon** : alertes gratuites lors d'une demande de modification ou d'une annulation client, par
  Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) et/ou par email (`SALON_NOTIFY_EMAIL`).
- **WhatsApp et SMS (Twilio)** : le code existe mais reste désactivé tant que les clés sont vides (WhatsApp Business
  est payant). Il n'est pas nécessaire au fonctionnement.

## Analytique (PostHog)

Le site public enregistre les visites et les interactions (pages vues, clics sur « Réserver », étapes du parcours de
réservation, confirmations) avec [PostHog](https://posthog.com) ; la page **Analytique** du back-office (réservée au
gérant) affiche les chiffres.

**Ce qui est suivi, et ce qui ne l'est pas**
- Sans cookie ni bannière de consentement (`cookieless_mode`) : pas d'identifiant stocké dans le navigateur.
- Envoyé : pages vues, clics sur des boutons précis (repère `data-ph="…"` dans le code), étapes de la réservation,
  réservation confirmée, annulation / demande de modification depuis le suivi, ouverture d'une photo de la galerie.
- Jamais envoyé : noms, téléphones, emails, notes, code de suivi (les adresses sont nettoyées avant l'envoi, seuls
  les paramètres `utm_*` sont gardés). Pas de capture automatique des clics, pas d'enregistrement d'écran.
- Le back-office et l'espace équipe ne sont pas suivis ; les visites d'un membre de l'équipe connecté sur le site public
  non plus (après sa première page vue).
- Les envois passent par l'adresse `/ingest` du site (pas directement par posthog.com) : les bloqueurs de publicité
  les laissent passer.

**Configuration (une fois)**
1. Créez un compte sur posthog.com, région **EU Cloud** (données en Europe), puis un projet « Maitre Coif ».
2. *Project settings → General* : notez la **Project API key** (`phc_…`) et le **Project ID** (numéro). Réglez le fuseau
   horaire du projet sur `Africa/Tunis` (sinon les jours sont découpés à l'heure UTC).
3. *Project settings* → rubrique **Cookieless server hash mode** (ou « Web analytics → Cookieless ») : **activez-le**.
   Sans cela, PostHog ignore tous les événements envoyés sans cookie.
4. *Account settings → Personal API keys → Create personal API key* : étendue **Query → Read** (lecture seule, rien
   d'autre), puis copiez la clé (`phx_…`). Elle ne s'affiche qu'une fois.
5. Dans Vercel (*Settings → Environment Variables*, environnement **Production** seulement, pour ne pas compter vos essais) :
   - `NEXT_PUBLIC_POSTHOG_KEY` = la Project API key (publique par nature : type « Config » dans Vercel) ;
   - `POSTHOG_PERSONAL_API_KEY` = la clé personnelle (type **Secret**, ne jamais la publier) ;
   - `POSTHOG_PROJECT_ID` = le numéro du projet.
   Les adresses par défaut sont celles de la région UE ; pour la région US, voir `.env.example`.
6. Redéployez. Visitez le site, puis ouvrez *Activity* dans PostHog : vos pages vues apparaissent en quelques secondes.
   Le back-office → Analytique affiche les chiffres (mis à jour toutes les 5 minutes).

**En cas de problème**
- Rien dans PostHog : vérifiez l'étape 3, et que `NEXT_PUBLIC_POSTHOG_KEY` est bien en *Production* (un redéploiement est
  nécessaire : la clé est intégrée au site lors du build). Ajoutez `NEXT_PUBLIC_POSTHOG_DEBUG=1` pour un journal détaillé
  dans la console du navigateur.
- « clé refusée » dans la page Analytique : la clé personnelle n'a pas la permission *Query read*, ou le numéro de projet est faux.
- Navigateurs de test automatisés (Playwright, bots) : ignorés par PostHog, c'est normal.
- Les visiteurs sont comptés **par jour** (le mode sans cookie ne reconnaît pas une même personne d'un jour à l'autre).

## Anti-bot (Cloudflare Turnstile)

La réservation en ligne est protégée par trois barrières : un champ piège invisible (honeypot), une limite de tentatives par adresse IP
(8 réservations / 10 min) et une vérification anti-robot Cloudflare Turnstile à la confirmation.

**Activer Turnstile (gratuit, 3 minutes)** :
1. Sur dash.cloudflare.com → Turnstile → « Add widget », domaine `maitrecoif.com` (ajoutez aussi `localhost` pour les essais), mode « Managed ».
2. Copiez les deux clés dans Vercel (Settings → Environment Variables) : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (clé du site) et `TURNSTILE_SECRET_KEY` (clé secrète), puis redéployez.
3. Tant que `TURNSTILE_SECRET_KEY` est vide, la vérification est désactivée (les deux autres barrières restent actives).

Pour essayer en local avec les clés de test de Cloudflare (le widget affiche « Success! » tout seul) :
`NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`.

**Attaques par saturation (DDoS)** : un captcha arrête les robots qui réservent, pas le trafic de masse. Ce second risque se traite avant
l'application : sur Vercel, activez le pare-feu (Firewall → « Attack Challenge Mode » en cas d'attaque, et une règle de limitation de
débit sur `/api/*`) ; ou placez le domaine derrière le proxy Cloudflare.

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

## Authentification du personnel (Clerk) et sous-domaine salon

- **Espace sécurisé sur un sous-domaine** : le back-office et la connexion du personnel sont servis sur
  `NEXT_PUBLIC_SALON_HOST` (ex. `salon.maitrecoif.com`) : `/planning`, `/equipe`, `/fermetures`, `/services`,
  `/galerie`, `/statistiques`, `/connexion`, `/inscription`. C'est la même application ; `proxy.ts` réécrit ces
  adresses vers les routes internes `/admin/*` et `/espace-equipe/*`, qui redirigent vers le sous-domaine quand on
  les appelle depuis le site public. Sans `NEXT_PUBLIC_SALON_HOST`, le back-office n'est servi nulle part.
- **Local** : `NEXT_PUBLIC_SALON_HOST=salon.localhost:3000`, puis ouvrir `http://salon.localhost:3000` (les navigateurs
  résolvent `*.localhost` vers votre machine).
- **Deux systèmes, une règle** : les clients restent sur Auth.js (`/connexion`, `/compte`, site public) ; le
  personnel utilise Clerk. `auth()` de `lib/auth.ts` renvoie la session du personnel (Clerk) en priorité, sinon celle
  du client : le reste du code n'a pas changé.
- **Les rôles restent en base** : un compte Clerk n'a accès au back-office que si son **email vérifié** correspond à
  un membre actif (`COIFFEUR` ou `ADMIN`) de la table `User` (`lib/staff.ts`). Un compte Clerk inconnu est renvoyé
  sur `/acces-refuse`.
- **Ajouter un membre** : la page Équipe crée la fiche et envoie automatiquement une invitation Clerk par email ;
  la personne y crée son mot de passe, puis se connecte sur le sous-domaine. Aucun mot de passe n'est stocké pour
  le personnel (Auth.js le refuse).
- **Sans clés Clerk** (preview, tests) : le site public et l'espace client fonctionnent, le back-office est fermé.

## Design du site public (« Séance »)

Le site public (accueil, services, équipe, réservation, suivi) suit une direction cinématique : noir et or, scènes
numérotées, pellicule pour les services, billet pour la réservation, pied de page en générique.

- **Styles** : `app/cinema.css`, importé uniquement par `app/(site)/layout.tsx`. Toutes les règles sont préfixées par
  `.mc`, le conteneur du gabarit public : le back-office et les composants hors de ce gabarit ne sont pas affectés.
- **Composants** : `components/site/` (navigation, pied de page, portrait, apparition progressive, effets de l'accueil,
  carrousel d'avis) et `components/reservation/` (assistant de réservation, suivi).
- **Portraits** : `lib/portraits.ts`. La planche de 4 portraits du seed (`maitre-coif-team.png`) est découpée, un portrait
  par personne (version allégée : `public/maitre-coif-portraits.webp`) ; au-delà, ou sans photo, un monogramme s'affiche.
  Une photo téléversée par le gérant passe avant.
- **Disponibilités** : `GET /api/disponibilites` renvoie aussi `grille` (créneaux libres et occupés) et
  `GET /api/disponibilites/jours` l'état des 21 prochains jours (libre, complet, fermé). L'accueil affiche la
  « prochaine disponibilité » (`lib/prochaine-disponibilite.ts`).
- **Mise en scène de l'accueil** : chaque section est un plan (`app/cinema-home.css`). Un seul moteur
  (`components/site/cinema.tsx`) écrit des variables CSS au défilement (`--fp` progression du plan, `--fi` position,
  `--ad` distance au centre) ; tout le mouvement (parallaxe, pellicule épinglée, profondeur de champ, projecteurs) est
  décrit en CSS. Le même moteur pilote le lecteur du bas (scène, barre cliquable, timecode 24 images/s : la page est
  un film de 2 min) et la lumière du premier plan qui suit la souris. Pas de bibliothèque d'animation.
- **Rideau d'ouverture** : une fois par session (`components/site/intro.tsx`), jamais en navigation interne.
- **Mouvement réduit / sans JavaScript** : tout est statique et lisible (pellicule en défilement horizontal natif,
  pas de rideau ni de grain). Pas de vidéo en lecture automatique.
- **Piège connu** : `overflow-x: hidden` sur `html`/`body` casse `position: sticky` (pellicule épinglée) ; le projet
  utilise `overflow-x: clip`.

## Back-office « Régie »

Le back-office reprend la direction « Séance » du site public, pensée pour travailler (`app/cinema-admin.css`, limité au
conteneur `.ad` de `app/admin/layout.tsx`) :

- **Planning = plan de tournage** (`components/admin/planning-board.tsx`) : une colonne par coiffeur, chaque rendez-vous
  positionné et dimensionné selon son heure et sa durée, **ligne rouge à l'heure du salon** (fuseau Africa/Tunis,
  rafraîchie toutes les 30 s), fiche du rendez-vous à droite (client, téléphone, demande de modification, actions :
  confirmer, terminer, déplacer, annuler avec confirmation). Vue « Liste » en alternative (par défaut sur mobile).
- **Statistiques = box-office** (`components/admin/statistiques-view.tsx`, présentation seule) : chiffre d'affaires,
  jauge de remplissage, répartition par statut, classement de l'équipe.
- **Équipe, services, fermetures, galerie** : listes restylées ; les composants partagés (boutons, champs, fenêtres)
  suivent le même langage via `[data-slot=…]`.
- **Barre latérale** : `AdminSidebar` ne dépend pas de Clerk (la déconnexion est injectée par `AdminSidebarClerk`), ce
  qui permet de la prévisualiser sans compte.

### Accéder au back-office en local

Le back-office n'est servi que sur le sous-domaine du salon et seulement si Clerk est configuré. En local :

1. Créez une application Clerk de **développement** (dashboard.clerk.com) et copiez ses deux clés dans `.env` :
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_…"` et `CLERK_SECRET_KEY="sk_test_…"`.
2. Dans `.env`, mettez `NEXT_PUBLIC_SALON_HOST="salon.localhost:3001"` (les navigateurs résolvent `*.localhost` vers votre machine, rien à configurer).
3. Dans Clerk (Users), créez un utilisateur avec **la même adresse email** qu'un membre `ADMIN` ou `COIFFEUR` actif de votre base locale (ex. celle du seed).
4. `npm run dev -- -p 3001`, puis ouvrez **http://salon.localhost:3001/connexion**, connectez-vous : vous arrivez sur `/planning`.

Le site public reste sur `http://localhost:3001`. Sans clés Clerk, `salon.localhost` ne sert rien : c'est voulu.
