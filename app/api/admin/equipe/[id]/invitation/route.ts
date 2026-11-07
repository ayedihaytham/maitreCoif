import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { inviterMembre } from '@/lib/staff'

// (Ré)envoie l'invitation Clerk d'un membre existant : fiche créée avant la mise
// en place de Clerk, invitation échouée ou expirée.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Évite d'inonder une boîte mail d'invitations.
  if (!(await checkRateLimit(`invitation:${session.user.id}`, 20, 15 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop d’invitations envoyées, réessayez dans quelques minutes.' }, { status: 429 })
  }

  const { id } = await params
  const membre = await prisma.user.findFirst({
    where: { id, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
    select: { email: true },
  })
  if (!membre) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

  // Une nouvelle invitation peut servir à recréer un accès perdu : la fiche est déliée de l'ancien compte Clerk
  // (elle se relie toute seule à la prochaine connexion, par l'email).
  await prisma.user.update({ where: { id }, data: { clerkId: null } })
  const { statut, detail } = await inviterMembre(membre.email)
  return NextResponse.json({ invitation: statut, invitationDetail: detail })
}
