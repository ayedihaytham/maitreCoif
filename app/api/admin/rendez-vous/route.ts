import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { creerRendezVousConfirme, finitAvantMinuit, notifierConfirmation } from '@/lib/booking'
import { genererCodeSuiviUnique } from '@/lib/code-suivi'
import { prisma } from '@/lib/prisma'
import { estDatePassee } from '@/lib/slots'
import { salonBookingSchema } from '@/lib/validators'

// Réservation saisie par le salon (appel, client sur place). Un coiffeur ne
// peut réserver que dans son propre planning ; l'admin dans celui de tous.
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'COIFFEUR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const parsed = salonBookingSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { coiffeurId, serviceId, date, heureDebut, clientNom, clientTelephone, clientEmail, notes } = parsed.data

  if (session.user.role === 'COIFFEUR' && coiffeurId !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const [coiffeur, service] = await Promise.all([
    prisma.user.findFirst({ where: { id: coiffeurId, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true } }),
    prisma.service.findFirst({ where: { id: serviceId, actif: true } }),
  ])
  if (!coiffeur || !service) return NextResponse.json({ error: 'Coiffeur ou service introuvable' }, { status: 404 })
  if (estDatePassee(date)) return NextResponse.json({ error: 'Impossible de réserver une date déjà passée.' }, { status: 400 })

  // Le salon peut saisir une heure hors horaires habituels, mais pas déborder sur le lendemain.
  if (!finitAvantMinuit(heureDebut, service.duree)) {
    return NextResponse.json({ error: 'Le rendez-vous doit se terminer avant minuit.' }, { status: 400 })
  }

  const rendezVous = await creerRendezVousConfirme({
    codeSuivi: await genererCodeSuiviUnique(),
    coiffeurId,
    serviceId,
    dureeService: service.duree,
    clientUserId: null,
    clientNom,
    clientTelephone,
    clientEmail: clientEmail || null,
    date,
    heureDebut,
    notes: notes || null,
  })
  if (!rendezVous) {
    return NextResponse.json({ error: "Ce créneau n'est pas libre (rendez-vous existant ou fermeture)." }, { status: 409 })
  }

  await notifierConfirmation(rendezVous, { coiffeurNom: `${coiffeur.prenom} ${coiffeur.nom}`, serviceNom: service.nom })
  return NextResponse.json({ id: rendezVous.id, codeSuivi: rendezVous.codeSuivi }, { status: 201 })
}
