import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'

function serialize(rdv: {
  id: string
  codeSuivi: string
  statut: string
  date: Date
  heureDebut: string
  heureFin: string
  notes: string | null
  coiffeur: { prenom: string; nom: string }
  service: { nom: string; prix: unknown; duree: number }
}) {
  return {
    id: rdv.id,
    codeSuivi: rdv.codeSuivi,
    statut: rdv.statut,
    date: rdv.date.toISOString().slice(0, 10),
    heureDebut: rdv.heureDebut,
    heureFin: rdv.heureFin,
    notes: rdv.notes,
    coiffeur: `${rdv.coiffeur.prenom} ${rdv.coiffeur.nom}`,
    service: rdv.service.nom,
    prix: Number(rdv.service.prix),
    duree: rdv.service.duree,
  }
}

export async function GET(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`suivi:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const codeSuivi = searchParams.get('codeSuivi')?.trim().toUpperCase()
  const telephone = searchParams.get('telephone')?.trim()

  if (!codeSuivi && !telephone) {
    return NextResponse.json({ error: 'Code de suivi ou téléphone requis' }, { status: 400 })
  }

  const rendezVous = await prisma.rendezVous.findMany({
    where: codeSuivi ? { codeSuivi } : { clientTelephone: telephone },
    orderBy: { date: 'desc' },
    include: {
      coiffeur: { select: { prenom: true, nom: true } },
      service: { select: { nom: true, prix: true, duree: true } },
    },
    take: 20,
  })

  return NextResponse.json(rendezVous.map(serialize))
}

// `||` plutôt que `??` : une variable d'environnement définie mais vide
// ("" côté Vercel, par ex.) doit retomber sur le défaut, pas donner 0.
const CANCELLATION_DEADLINE_HOURS = Number(process.env.CANCELLATION_DEADLINE_HOURS || 2)

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`suivi-annulation:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const { id, codeSuivi } = body as { id?: string; codeSuivi?: string }

  if (!id || !codeSuivi) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const rendezVous = await prisma.rendezVous.findFirst({
    where: { id, codeSuivi: codeSuivi.trim().toUpperCase() },
  })

  if (!rendezVous) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

  if (rendezVous.statut !== 'EN_ATTENTE' && rendezVous.statut !== 'CONFIRME') {
    return NextResponse.json({ error: 'Ce rendez-vous ne peut plus être annulé.' }, { status: 400 })
  }

  const rdvDateTime = new Date(rendezVous.date)
  const [h, m] = rendezVous.heureDebut.split(':').map(Number)
  rdvDateTime.setUTCHours(h, m, 0, 0)

  const heuresRestantes = (rdvDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
  if (heuresRestantes < CANCELLATION_DEADLINE_HOURS) {
    return NextResponse.json(
      { error: `L'annulation n'est plus possible moins de ${CANCELLATION_DEADLINE_HOURS}h avant le rendez-vous.` },
      { status: 400 },
    )
  }

  const updated = await prisma.rendezVous.update({ where: { id }, data: { statut: 'ANNULE' } })
  return NextResponse.json({ statut: updated.statut })
}
