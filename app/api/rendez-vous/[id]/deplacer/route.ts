import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { deplacerRendezVous, finitAvantMinuit, notifierDeplacement } from '@/lib/booking'
import { prisma } from '@/lib/prisma'
import { estDatePassee, timeToMinutes } from '@/lib/slots'
import { deplacementSchema } from '@/lib/validators'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'COIFFEUR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { id } = await params
  const rendezVous = await prisma.rendezVous.findUnique({ where: { id }, include: { service: { select: { nom: true } } } })
  if (!rendezVous) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

  const parsed = deplacementSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const coiffeurId = parsed.data.coiffeurId ?? rendezVous.coiffeurId

  // Un coiffeur ne gère que son propre planning (source et destination).
  if (session.user.role === 'COIFFEUR' && (rendezVous.coiffeurId !== session.user.id || coiffeurId !== session.user.id)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  if (rendezVous.statut !== 'EN_ATTENTE' && rendezVous.statut !== 'CONFIRME') {
    return NextResponse.json({ error: 'Seul un rendez-vous actif peut être déplacé.' }, { status: 400 })
  }
  if (estDatePassee(parsed.data.date)) {
    return NextResponse.json({ error: 'Impossible de déplacer vers une date déjà passée.' }, { status: 400 })
  }

  const duree = timeToMinutes(rendezVous.heureFin) - timeToMinutes(rendezVous.heureDebut)
  if (!finitAvantMinuit(parsed.data.heureDebut, duree)) {
    return NextResponse.json({ error: 'Le rendez-vous doit se terminer avant minuit.' }, { status: 400 })
  }

  const coiffeur = await prisma.user.findFirst({ where: { id: coiffeurId, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true } })
  if (!coiffeur) return NextResponse.json({ error: 'Coiffeur introuvable' }, { status: 404 })

  const deplace = await deplacerRendezVous(rendezVous, { coiffeurId, date: parsed.data.date, heureDebut: parsed.data.heureDebut })
  if (!deplace) {
    return NextResponse.json({ error: "Ce créneau n'est pas libre (rendez-vous existant ou fermeture)." }, { status: 409 })
  }

  await notifierDeplacement(deplace, { coiffeurNom: `${coiffeur.prenom} ${coiffeur.nom}`, serviceNom: rendezVous.service.nom })
  return NextResponse.json(deplace)
}
