import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'

// Utilisateur connecté (client ou personnel), lu par la barre de navigation du site public.
// Les pages publiques sont ainsi servies sans lire les cookies, donc mises en cache (CDN).
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  return NextResponse.json(
    { user: session?.user ? { name: session.user.name ?? null, role: session.user.role } : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
