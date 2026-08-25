/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // L'optimisation d'images de Next.js (redimensionnement, AVIF/WebP) est
    // gratuite et native sur Vercel — inutile de la désactiver en production.
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
