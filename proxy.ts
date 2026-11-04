import { clerkMiddleware } from '@clerk/nextjs/server'
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server'

import { ancienneVersSalon, estHoteSalon, salonUrl, versRouteInterne } from '@/lib/salon-host'
import { clerkConfigured, staffDepuisClerk, type StaffUser } from '@/lib/staff'

// Routes internes réservées à l'administrateur (les coiffeurs n'ont que le planning).
const ADMIN_ONLY = ['/admin/equipe', '/admin/services', '/admin/statistiques', '/admin/galerie', '/admin/fermetures']

// Clerk doit s'exécuter sur toutes les routes où `auth()` est appelé (pages,
// API, en-tête du site) ; seuls les fichiers statiques sont exclus.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

type Identite = { userId: string | null | undefined; staff: StaffUser | null }

/** Une page qui n'existe pas : Next.js renvoie alors son 404. */
function introuvable(req: NextRequest) {
  return NextResponse.rewrite(new URL('/__introuvable', req.url))
}

/**
 * Routage par nom d'hôte. Retourne une réponse (réécriture/redirection) ou
 * undefined pour laisser passer la requête telle quelle.
 */
async function router(req: NextRequest, identite: () => Promise<Identite>): Promise<NextResponse | undefined> {
  const { pathname, search } = req.nextUrl
  const estApi = pathname.startsWith('/api') || pathname.startsWith('/trpc')

  // ── Site public : l'espace sécurisé n'y est plus joignable ──────────────
  if (!estHoteSalon(req.headers.get('host'))) {
    const nouvelle = ancienneVersSalon(pathname)
    if (!nouvelle) return undefined
    // Les anciens favoris et liens d'invitation sont renvoyés vers le sous-domaine.
    return process.env.NEXT_PUBLIC_SALON_HOST ? NextResponse.redirect(`${salonUrl(nouvelle)}${search}`) : introuvable(req)
  }

  // ── Sous-domaine du salon ───────────────────────────────────────────────
  if (estApi) return undefined // les routes API font leurs propres contrôles
  if (pathname === '/') return NextResponse.redirect(new URL('/planning', req.url))

  const interne = versRouteInterne(pathname)
  if (!interne) return introuvable(req)

  if (interne.startsWith('/admin')) {
    const { userId, staff } = await identite()

    if (!staff) {
      // Connecté chez Clerk mais inconnu de l'équipe : surtout ne pas renvoyer
      // vers la connexion (Clerk le rebasculerait ici, d'où une boucle).
      if (userId) return NextResponse.redirect(new URL('/acces-refuse', req.url))
      const url = new URL('/connexion', req.url)
      url.searchParams.set('redirect_url', pathname)
      return NextResponse.redirect(url)
    }
    if (ADMIN_ONLY.includes(interne) && staff.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/planning', req.url))
    }
  }

  return NextResponse.rewrite(new URL(`${interne}${search}`, req.url))
}

const clerk = clerkMiddleware(async (auth, req) =>
  router(req, async () => {
    const { userId, sessionClaims } = await auth()
    return { userId, staff: await staffDepuisClerk(userId, sessionClaims) }
  }),
)

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  // Sans clés Clerk (preview, tests locaux) le site public reste servi, mais
  // personne n'est identifié : le back-office est fermé plutôt que sans protection.
  if (!clerkConfigured()) {
    return (await router(req, async () => ({ userId: null, staff: null }))) ?? NextResponse.next()
  }
  return clerk(req, event)
}
