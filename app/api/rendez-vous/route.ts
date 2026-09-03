import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { genererCodeSuiviUnique } from '@/lib/code-suivi'
import { envoyerConfirmationEmail } from '@/lib/notifications'
import { envoyerConfirmationWhatsapp } from '@/lib/whatsapp'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { creneauEstLibre, minutesToTime, timeToMinutes } from '@/lib/slots'
import { guestBookingSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`reservation:${ip}`, 8, 10 * 60 * 1000)) {
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

  const { coiffeurId, serviceId, date, heureDebut, clientNom, clientTelephone, clientEmail, notes } = parsed.data

  const [coiffeur, service] = await Promise.all([
    prisma.user.findFirst({ where: { id: coiffeurId, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true } }),
    prisma.service.findFirst({ where: { id: serviceId, actif: true } }),
  ])

  if (!coiffeur || !service) {
    return NextResponse.json({ error: 'Coiffeur ou service introuvable' }, { status: 404 })
  }

  const heureFin = minutesToTime(timeToMinutes(heureDebut) + service.duree)

  const libre = await creneauEstLibre(coiffeurId, date, heureDebut, heureFin)
  if (!libre) {
    return NextResponse.json({ error: 'Ce créneau vient d\'être réservé, merci d\'en choisir un autre.' }, { status: 409 })
  }

  const session = await auth()
  const codeSuivi = await genererCodeSuiviUnique()

  const rendezVous = await prisma.rendezVous.create({
    data: {
      codeSuivi,
      coiffeurId,
      serviceId,
      clientUserId: session?.user.role === 'CLIENT' ? session.user.id : null,
      clientNom,
      clientTelephone,
      clientEmail: clientEmail || null,
      date: new Date(`${date}T00:00:00Z`),
      heureDebut,
      heureFin,
      notes: notes || null,
      // Confirmation automatique : le créneau était libre à l'instant de la
      // réservation, aucune validation manuelle du gérant n'est nécessaire.
      statut: 'CONFIRME',
    },
  })

  // Le rendez-vous est déjà enregistré à ce stade : un échec d'envoi
  // (Twilio/Resend indisponible, numéro invalide...) ne doit jamais faire
  // échouer la réservation elle-même côté client.
  const notifications: Promise<unknown>[] = [
    envoyerConfirmationWhatsapp({
      to: clientTelephone,
      coiffeurNom: `${coiffeur.prenom} ${coiffeur.nom}`,
      serviceNom: service.nom,
      date,
      heureDebut,
      codeSuivi,
    }),
  ]
  if (clientEmail) {
    notifications.push(
      envoyerConfirmationEmail({
        to: clientEmail,
        clientNom,
        coiffeurNom: `${coiffeur.prenom} ${coiffeur.nom}`,
        serviceNom: service.nom,
        date,
        heureDebut,
        codeSuivi,
      }),
    )
  }
  const results = await Promise.allSettled(notifications)
  for (const result of results) {
    if (result.status === 'rejected') console.error('Échec de notification de confirmation :', result.reason)
  }

  return NextResponse.json({ id: rendezVous.id, codeSuivi }, { status: 201 })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'COIFFEUR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

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
      service: { select: { id: true, nom: true, duree: true, prix: true } },
    },
  })

  return NextResponse.json(rendezVous)
}
