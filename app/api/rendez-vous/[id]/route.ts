import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inclurePrestations, prestationsDuRendezVous } from '@/lib/prestations'
import { envoyerAnnulationEmail } from '@/lib/notifications'
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

  if (parsed.data.statut === 'ANNULE' && rendezVous.clientEmail) {
    await envoyerAnnulationEmail({
      to: rendezVous.clientEmail,
      clientNom: rendezVous.clientNom,
      coiffeurNom: `${rendezVous.coiffeur.prenom} ${rendezVous.coiffeur.nom}`,
      serviceNom: prestationsDuRendezVous(rendezVous).nom,
      date: rendezVous.date.toISOString().slice(0, 10),
      heureDebut: rendezVous.heureDebut,
      codeSuivi: rendezVous.codeSuivi,
      parLeSalon: true,
    }).catch((e) => console.error("Échec de l'email d'annulation :", e))
  }

  return NextResponse.json(updated)
}
