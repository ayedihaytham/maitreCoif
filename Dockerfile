# syntax=docker/dockerfile:1.7
#
# Image de production de Maitre Coif (serveur dédié). Trois cibles :
#   - runner  (par défaut) : le site, serveur Node « standalone » minimal, utilisateur non-root ;
#   - migrate              : applique les migrations Prisma (lancée à chaque déploiement, avant le site).
# Voir deploy/README.md pour l'ensemble de l'installation.

ARG NODE_VERSION=22

# ───────── Base : Node + pnpm + OpenSSL (requis par le moteur Prisma) ─────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app

# ───────── Dépendances (couche mise en cache tant que le lockfile ne change pas) ─────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# ───────── Migrations : Prisma CLI + dossier prisma/ ─────────
FROM deps AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ───────── Construction du site ─────────
FROM deps AS build
COPY . .

# Variables « NEXT_PUBLIC_* » : elles sont inscrites dans le code au moment du build (elles ne sont pas secrètes).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SALON_HOST
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_UI_HOST
ARG NEXT_PUBLIC_SALON_MAP_QUERY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SALON_HOST=$NEXT_PUBLIC_SALON_HOST \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_UI_HOST=$NEXT_PUBLIC_POSTHOG_UI_HOST \
    NEXT_PUBLIC_SALON_MAP_QUERY=$NEXT_PUBLIC_SALON_MAP_QUERY

# Le build n'a pas accès à la vraie base : une adresse factice suffit à Prisma pour générer son client,
# et RENDER_DYNAMIC=1 empêche toute page d'être pré-rendue avec des données figées (cf. app/layout.tsx).
ENV BUILD_STANDALONE=1 \
    RENDER_DYNAMIC=1 \
    NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm exec prisma generate && pnpm exec next build

# ───────── Image finale ─────────
FROM base AS runner
# --dns-result-order=ipv4first : « localhost » doit viser 127.0.0.1 (le serveur n'écoute qu'en IPv4 dans le
# conteneur), sinon Next.js échoue à se rappeler lui-même (« socket hang up »).
ENV NODE_ENV=production \
    RENDER_DYNAMIC=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS=--dns-result-order=ipv4first
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs --home /app nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Cache de l'optimisation d'images : monté en volume pour survivre aux déploiements.
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
