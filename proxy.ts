import { clerkMiddleware } from '@clerk/nextjs/server'
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server'

import { clerkConfigured, staffDepuisClerk } from '@/lib/staff'

const ADMIN_ONLY_PREFIXES = ['/admin/equipe', '/admin/services', '/admin/statistiques', '/admin/galerie', '/admin/fermetures']

// Clerk doit s'exécuter sur toutes les routes où `auth()` est appelé (pages,
// API, en-tête du site) ; seuls les fichiers statiques sont exclus.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

const clerk = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // Seul le back-office est protégé ici. /compte (clients, Auth.js) l'est
  // dans sa page, car Auth.js et Clerk ne partagent pas de session.
  if (!pathname.startsWith('/admin')) return

  const { userId, sessionClaims } = await auth()
  const staff = await staffDepuisClerk(userId, sessionClaims)

  if (!staff) {
    // Connecté chez Clerk mais inconnu de l'équipe : surtout ne pas renvoyer
    // vers la connexion (Clerk le rebasculerait ici, d'où une boucle).
    const cible = userId ? '/espace-equipe/acces-refuse' : '/espace-equipe'
    const url = new URL(cible, req.nextUrl)
    if (!userId) url.searchParams.set('redirect_url', pathname)
    return NextResponse.redirect(url)
  }

  if (ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && staff.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/admin/planning', req.nextUrl))
  }
})

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Sans clés Clerk (preview, tests locaux) le site public reste servi, mais
  // le back-office est fermé plutôt que laissé sans protection.
  if (!clerkConfigured()) {
    if (req.nextUrl.pathname.startsWith('/admin')) return NextResponse.redirect(new URL('/', req.nextUrl))
    return NextResponse.next()
  }
  return clerk(req, event)
}
