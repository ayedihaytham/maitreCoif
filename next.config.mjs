/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les navigateurs réclament /favicon.ico : on les sert avec l'icône de l'application (évite un 404).
  async rewrites() {
    // Suivi d'audience (PostHog) : les envois passent par le site lui-même (/ingest) pour ne pas être
    // bloqués par les bloqueurs de publicité. Région UE par défaut ; POSTHOG_INGEST_HOST / POSTHOG_ASSETS_HOST
    // permettent de viser une autre région (ex. https://us.i.posthog.com) ou un serveur de test.
    const ingestion = (process.env.POSTHOG_INGEST_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '')
    const ressources = (process.env.POSTHOG_ASSETS_HOST || 'https://eu-assets.i.posthog.com').replace(/\/$/, '')
    return [
      { source: '/favicon.ico', destination: '/icon.png' },
      { source: '/ingest/static/:path*', destination: `${ressources}/static/:path*` },
      { source: '/ingest/array/:path*', destination: `${ressources}/array/:path*` },
      { source: '/ingest/:path*', destination: `${ingestion}/:path*` },
    ]
  },
  // PostHog utilise des adresses terminées par « / » : Next.js ne doit pas les rediriger.
  skipTrailingSlashRedirect: true,
  images: {
    // L'optimisation d'images de Next.js (redimensionnement, AVIF/WebP) est
    // gratuite et native sur Vercel — inutile de la désactiver en production.
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
