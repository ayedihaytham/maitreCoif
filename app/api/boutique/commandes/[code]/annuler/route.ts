import { NextResponse } from 'next/server'

import { changerStatutCommande } from '@/lib/boutique'
import { notifierAnnulationCommande } from '@/lib/boutique-emails'
import { CODE_COMMANDE_VALIDE } from '@/lib/liens'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'

// Annulation par le client depuis la page de sa réservation : le code fait office de clé, comme pour le suivi
// d'un rendez-vous. Le stock est rendu ; le client reçoit un email et le salon est alerté.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await checkRateLimit(`commande-annuler:${clientIpFrom(request.headers)}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }
  const code = decodeURIComponent((await params).code).trim().toUpperCase()
  if (!CODE_COMMANDE_VALIDE.test(code)) return NextResponse.json({ error: 'Code invalide' }, { status: 400 })

  const commande = await prisma.commande.findUnique({ where: { code }, select: { id: true, statut: true } })
  if (!commande) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  if (commande.statut !== 'A_PREPARER' && commande.statut !== 'PRETE') {
    return NextResponse.json({ error: 'Cette réservation ne peut plus être annulée.' }, { status: 409 })
  }

  const resultat = await changerStatutCommande(commande.id, 'ANNULEE')
  if (!resultat.ok) return NextResponse.json({ error: 'Cette réservation ne peut plus être annulée.' }, { status: 409 })

  await notifierAnnulationCommande(resultat.commande, false)
  return NextResponse.json({ annulee: true })
}
