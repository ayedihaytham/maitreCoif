import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { creerRendezVousConfirme, notifierConfirmation } from '@/lib/booking'
import { chargerPrestations, inclurePrestations, totaux } from '@/lib/prestations'
import { prisma } from '@/lib/prisma'
import { terminerRendezVousPasses } from '@/lib/terminer-passes'
import { genererCodeSuiviUnique } from '@/lib/code-suivi'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { creneauEstProposable, estDatePassee } from '@/lib/slots'
import { verifierTurnstile } from '@/lib/turnstile'
import { guestBookingSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!(await checkRateLimit(`reservation:${ip}`, 8, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = guestBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (parsed.data.website) {
    // Honeypot rempli : soumission automatisée, on répond succès factice sans rien créer.
    return NextResponse.json({ codeSuivi: 'MC-0000000' }, { status: 201 })
  }
  if (!(await verifierTurnstile(parsed.data.turnstileToken, ip))) {
    return NextResponse.json({ error: 'Vérification anti-robot échouée, merci de réessayer.' }, { status: 400 })
  }

  const { coiffeurId, serviceIds, date, heureDebut, clientNom, clientTelephone, clientEmail, notes } = parsed.data

  const [coiffeur, prestations] = await Promise.all([
    prisma.user.findFirst({ where: { id: coiffeurId, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true } }),
    chargerPrestations(serviceIds),
  ])

  if (!coiffeur || !prestations || prestations.length !== new Set(serviceIds).size) {
    return NextResponse.json({ error: 'Coiffeur ou service introuvable' }, { status: 404 })
  }

  if (estDatePassee(date)) {
    return NextResponse.json({ error: 'Impossible de réserver une date déjà passée.' }, { status: 400 })
  }

  // Le créneau doit faire partie de ceux réellement proposés (horaires du
  // coiffeur, fermetures, créneau pas déjà passé) : l'API ne doit pas
  // accepter un horaire que l'interface n'aurait jamais affiché.
  if (!(await creneauEstProposable(coiffeurId, serviceIds, date, heureDebut))) {
    return NextResponse.json({ error: "Ce créneau n'est pas disponible, merci d'en choisir un autre." }, { status: 409 })
  }

  const session = await auth()
  const rendezVous = await creerRendezVousConfirme({
    codeSuivi: await genererCodeSuiviUnique(),
    coiffeurId,
    prestations,
    clientUserId: session?.user.role === 'CLIENT' ? session.user.id : null,
    clientNom,
    clientTelephone,
    clientEmail: clientEmail || null,
    date,
    heureDebut,
    notes: notes || null,
  })

  if (!rendezVous) {
    return NextResponse.json({ error: "Ce créneau vient d'être réservé, merci d'en choisir un autre." }, { status: 409 })
  }

  await notifierConfirmation(rendezVous, { coiffeurNom: `${coiffeur.prenom} ${coiffeur.nom}`, serviceNom: totaux(prestations).nom })

  return NextResponse.json({ id: rendezVous.id, codeSuivi: rendezVous.codeSuivi }, { status: 201 })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'COIFFEUR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  await terminerRendezVousPasses()
  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const coiffeurIdParam = searchParams.get('coiffeurId')

  const where: Record<string, unknown> = {}

  if (session.user.role === 'COIFFEUR') {
    where.coiffeurId = session.user.id
  } else if (coiffeurIdParam) {
    where.coiffeurId = coiffeurIdParam
  }

  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T00:00:00Z`) } : {}),
    }
  }

  const rendezVous = await prisma.rendezVous.findMany({
    where,
    orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    include: {
      coiffeur: { select: { id: true, nom: true, prenom: true } },
      ...inclurePrestations,
      demandesModification: { where: { traitee: false }, select: { id: true, message: true } },
    },
  })

  return NextResponse.json(rendezVous)
}
