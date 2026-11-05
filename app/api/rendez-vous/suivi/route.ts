import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { inclurePrestations, prestationsDuRendezVous } from '@/lib/prestations'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { alerterSalon } from '@/lib/alerte-salon'
import { envoyerAnnulationEmail, formaterDateLongue } from '@/lib/notifications'
import { heuresAvantRendezVous } from '@/lib/slots'

function serialize(rdv: {
  id: string
  codeSuivi: string
  statut: string
  date: Date
  heureDebut: string
  heureFin: string
  notes: string | null
  demandesModification: { message: string }[]
  coiffeur: { prenom: string; nom: string }
  service: { nom: string; prix: unknown; duree: number }
  lignes: { nom: string; prix: unknown; duree: number; ordre: number }[]
}) {
  const presta = prestationsDuRendezVous(rdv)
  return {
    id: rdv.id,
    codeSuivi: rdv.codeSuivi,
    statut: rdv.statut,
    date: rdv.date.toISOString().slice(0, 10),
    heureDebut: rdv.heureDebut,
    heureFin: rdv.heureFin,
    notes: rdv.notes,
    demandeEnCours: rdv.demandesModification[0]?.message ?? null,
    coiffeur: `${rdv.coiffeur.prenom} ${rdv.coiffeur.nom}`,
    service: presta.nom,
    prestations: (rdv.lignes.length > 0 ? rdv.lignes : [rdv.service]).map((l) => l.nom),
    prix: presta.prix,
    duree: presta.duree,
  }
}

export async function GET(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!(await checkRateLimit(`suivi:${ip}`, 20, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  // Le code de suivi est le seul secret qui prouve que l'on est le client :
  // aucune recherche par téléphone, sinon n'importe qui pourrait lister (et
  // annuler) les rendez-vous d'un tiers à partir de son numéro.
  const codeSuivi = searchParams.get('codeSuivi')?.trim().toUpperCase()

  if (!codeSuivi) {
    return NextResponse.json({ error: 'Code de suivi requis' }, { status: 400 })
  }

  const rendezVous = await prisma.rendezVous.findMany({
    where: { codeSuivi },
    orderBy: { date: 'desc' },
    include: {
      coiffeur: { select: { prenom: true, nom: true } },
      ...inclurePrestations,
      demandesModification: { where: { traitee: false }, select: { message: true }, take: 1 },
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
  if (!(await checkRateLimit(`suivi-annulation:${ip}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const { id, codeSuivi } = body as { id?: string; codeSuivi?: string }

  if (!id || !codeSuivi) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const rendezVous = await prisma.rendezVous.findFirst({
    where: { id, codeSuivi: codeSuivi.trim().toUpperCase() },
    include: { coiffeur: { select: { prenom: true, nom: true } }, ...inclurePrestations },
  })

  if (!rendezVous) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

  if (rendezVous.statut !== 'EN_ATTENTE' && rendezVous.statut !== 'CONFIRME') {
    return NextResponse.json({ error: 'Ce rendez-vous ne peut plus être annulé.' }, { status: 400 })
  }

  const heuresRestantes = heuresAvantRendezVous(rendezVous.date.toISOString().slice(0, 10), rendezVous.heureDebut)
  if (heuresRestantes < CANCELLATION_DEADLINE_HOURS) {
    return NextResponse.json(
      { error: `L'annulation n'est plus possible moins de ${CANCELLATION_DEADLINE_HOURS}h avant le rendez-vous.` },
      { status: 400 },
    )
  }

  const updated = await prisma.rendezVous.update({ where: { id }, data: { statut: 'ANNULE' } })

  await alerterSalon(
    'Rendez-vous annulé par le client',
    `${rendezVous.clientNom} (${rendezVous.clientTelephone}) a annulé son rendez-vous du ${formaterDateLongue(rendezVous.date.toISOString().slice(0, 10))} à ${rendezVous.heureDebut} avec ${rendezVous.coiffeur.prenom} ${rendezVous.coiffeur.nom} (${prestationsDuRendezVous(rendezVous).nom}). Le créneau est de nouveau libre.`,
  )

  if (rendezVous.clientEmail) {
    await envoyerAnnulationEmail({
      to: rendezVous.clientEmail,
      clientNom: rendezVous.clientNom,
      coiffeurNom: `${rendezVous.coiffeur.prenom} ${rendezVous.coiffeur.nom}`,
      serviceNom: prestationsDuRendezVous(rendezVous).nom,
      date: rendezVous.date.toISOString().slice(0, 10),
      heureDebut: rendezVous.heureDebut,
      codeSuivi: rendezVous.codeSuivi,
      parLeSalon: false,
    }).catch((e) => console.error("Échec de l'email d'annulation :", e))
  }

  return NextResponse.json({ statut: updated.statut })
}
