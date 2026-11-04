import { NextResponse } from 'next/server'

import { alerterSalon } from '@/lib/alerte-salon'
import { formaterDateLongue } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { demandeModificationSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!(await checkRateLimit(`demande-modification:${ip}`, 10, 15 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = demandeModificationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, codeSuivi, message } = parsed.data

  const rendezVous = await prisma.rendezVous.findFirst({
    where: { id, codeSuivi: codeSuivi.trim().toUpperCase() },
    include: { coiffeur: { select: { prenom: true, nom: true } } },
  })

  if (!rendezVous) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

  if (rendezVous.statut !== 'EN_ATTENTE' && rendezVous.statut !== 'CONFIRME') {
    return NextResponse.json({ error: 'Une modification ne peut plus être demandée pour ce rendez-vous.' }, { status: 400 })
  }

  const dejaEnCours = await prisma.demandeModification.findFirst({ where: { rendezVousId: id, traitee: false } })
  if (dejaEnCours) {
    return NextResponse.json({ error: 'Une demande est déjà en cours de traitement pour ce rendez-vous.' }, { status: 409 })
  }

  // Le rendez-vous reste confirmé (et son créneau bloqué) tant que le salon
  // n'a pas répondu : la demande est tracée à part, plus dans les notes.
  await prisma.demandeModification.create({ data: { rendezVousId: id, message: message.trim() } })

  await alerterSalon(
    'Demande de modification de rendez-vous',
    `${rendezVous.clientNom} (${rendezVous.clientTelephone}) souhaite modifier son rendez-vous du ${formaterDateLongue(rendezVous.date.toISOString().slice(0, 10))} à ${rendezVous.heureDebut} avec ${rendezVous.coiffeur.prenom} ${rendezVous.coiffeur.nom}.\n\nMessage : ${message.trim()}\n\nÀ traiter depuis le planning (bouton Déplacer).`,
  )

  return NextResponse.json({ statut: rendezVous.statut, demandeEnCours: true })
}
