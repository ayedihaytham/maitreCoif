import { NextResponse } from 'next/server'

import { lieuDepuisEntetes } from '@/lib/lieu-visiteur'

// Pays et ville du visiteur (en-têtes Cloudflare), pour le suivi d'audience : le navigateur les ajoute à ses
// événements PostHog, qui ne peut pas les déduire lui-même en mode sans cookie. Jamais l'adresse IP.
export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return NextResponse.json(lieuDepuisEntetes(request.headers), { headers: { 'Cache-Control': 'no-store' } })
}
