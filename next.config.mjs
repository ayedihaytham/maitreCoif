/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les navigateurs réclament /favicon.ico : on les sert avec l'icône de l'application (évite un 404).
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon.png' }]
  },
  images: {
    // L'optimisation d'images de Next.js (redimensionnement, AVIF/WebP) est
    // gratuite et native sur Vercel — inutile de la désactiver en production.
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
