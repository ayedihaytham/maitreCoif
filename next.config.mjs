const PRISMA_INUTILE = ['node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/runtime/*_bg.*']

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image Docker (serveur dédié) : sortie « standalone » = serveur Node minimal avec seulement les fichiers utiles.
  // En développement local, la variable n'est pas définie.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  // Les navigateurs réclament /favicon.ico : on les sert avec l'icône de l'application (évite un 404).
  async rewrites() {
    // Suivi d'audience (PostHog) : les envois passent par le site lui-même (/ingest) pour ne pas être
    // bloqués par les bloqueurs de publicité. Région US par défaut (celle du compte PostHog du salon). ATTENTION : ces adresses sont lues
    // à la CONSTRUCTION de l'image (pas au démarrage) : POSTHOG_INGEST_HOST / POSTHOG_ASSETS_HOST permettent de viser une autre
    // région (ex. https://eu.i.posthog.com) mais doivent alors être fournies au build.
    const ingestion = (process.env.POSTHOG_INGEST_HOST || 'https://us.i.posthog.com').replace(/\/$/, '')
    const ressources = (process.env.POSTHOG_ASSETS_HOST || 'https://us-assets.i.posthog.com').replace(/\/$/, '')
    return [
      { source: '/favicon.ico', destination: '/icon.png' },
      { source: '/ingest/static/:path*', destination: `${ressources}/static/:path*` },
      { source: '/ingest/array/:path*', destination: `${ressources}/array/:path*` },
      { source: '/ingest/:path*', destination: `${ingestion}/:path*` },
    ]
  },
  // Taille de l'image Docker. Chaque route embarquait ~58 Mo de modules
  // WebAssembly de Prisma pour d'autres bases de données (MySQL, SQLite, SQL Server, CockroachDB...) et pour les
  // environnements « edge » : inutiles ici, car le site utilise PostgreSQL avec le moteur natif de Prisma.
  outputFileTracingExcludes: {
    '/**': PRISMA_INUTILE,
    '/proxy': PRISMA_INUTILE,
    '/middleware': PRISMA_INUTILE,
    middleware: PRISMA_INUTILE,
    proxy: PRISMA_INUTILE,
  },
  // PostHog utilise des adresses terminées par « / » : Next.js ne doit pas les rediriger.
  skipTrailingSlashRedirect: true,
  images: {
    // Optimisation d'images (redimensionnement, AVIF/WebP) : faite par le serveur Node avec « sharp » (dépendance du projet), cache conservé dans .next/cache.
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
