import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inclurePrestations } from '@/lib/prestations'
import { envoyerAnnulationEmail, envoyerConfirmationEmail, envoyerTermineEmail } from '@/lib/notifications'
import { detailsEmailClient } from '@/lib/rdv-emails'
import { rendezVousStatutSchema } from '@/lib/validators'

const TRANSITIONS: Record<string, string[]> = {
  EN_ATTENTE: ['CONFIRME', 'ANNULE'],
  CONFIRME: ['TERMINE', 'ANNULE'],
  TERMINE: [],
  ANNULE: [],
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'COIFFEUR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { id } = await params
  const rendezVous = await prisma.rendezVous.findUnique({
    where: { id },
    include: { coiffeur: { select: { prenom: true, nom: true } }, ...inclurePrestations },
  })
  if (!rendezVous) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

  if (session.user.role === 'COIFFEUR' && rendezVous.coiffeurId !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = rendezVousStatutSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!TRANSITIONS[rendezVous.statut].includes(parsed.data.statut)) {
    return NextResponse.json(
      { error: `Transition invalide : ${rendezVous.statut} → ${parsed.data.statut}` },
      { status: 400 },
    )
  }

  const updated = await prisma.rendezVous.update({ where: { id }, data: { statut: parsed.data.statut } })

  // Tout changement de statut décidé par le salon est notifié au client (s'il a laissé un email).
  const details = detailsEmailClient(rendezVous)
  if (details) {
    const envoi =
      parsed.data.statut === 'ANNULE'
        ? envoyerAnnulationEmail({ ...details, parLeSalon: true })
        : parsed.data.statut === 'CONFIRME'
          ? envoyerConfirmationEmail(details)
          : envoyerTermineEmail(details)
    await envoi.catch((e) => console.error(`Échec de l'email de changement de statut (${parsed.data.statut}) :`, e))
  }

  return NextResponse.json(updated)
}
