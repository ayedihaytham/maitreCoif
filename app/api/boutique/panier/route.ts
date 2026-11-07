import { NextResponse } from 'next/server'

import { resoudrePanier } from '@/lib/boutique'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { panierSchema } from '@/lib/validators'

// Revalide le panier du navigateur avec les prix et le stock actuels (le navigateur n'est jamais cru sur les prix).
export async function POST(request: Request) {
  if (!(await checkRateLimit(`panier:${clientIpFrom(request.headers)}`, 90, 5 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de requêtes, veuillez réessayer dans quelques minutes.' }, { status: 429 })
  }
  const parsed = panierSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Panier invalide' }, { status: 400 })

  return NextResponse.json(await resoudrePanier(parsed.data.lignes))
}
