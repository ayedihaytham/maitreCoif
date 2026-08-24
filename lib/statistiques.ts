import { prisma } from '@/lib/prisma'
import { timeToMinutes } from '@/lib/slots'

export type Periode = 'semaine' | 'mois' | 'annee'

export function getPlage(periode: Periode) {
  const now = new Date()
  const to = new Date()
  to.setUTCHours(23, 59, 59, 999)
  const from = new Date()
  from.setUTCHours(0, 0, 0, 0)

  if (periode === 'semaine') {
    // "7 derniers jours" est par nature borné à aujourd'hui.
    from.setUTCDate(from.getUTCDate() - 6)
  } else if (periode === 'mois') {
    // Le mois entier, y compris les rendez-vous à venir plus tard dans le
    // mois — pas seulement jusqu'à aujourd'hui.
    from.setUTCDate(1)
    to.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
    to.setUTCHours(23, 59, 59, 999)
  } else {
    from.setUTCMonth(0, 1)
    to.setUTCFullYear(now.getUTCFullYear(), 11, 31)
    to.setUTCHours(23, 59, 59, 999)
  }

  return { from, to }
}

function* eachDate(from: Date, to: Date) {
  const d = new Date(from)
  while (d <= to) {
    yield new Date(d)
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

export async function getStatistiques(periode: Periode) {
  const { from, to } = getPlage(periode)

  const [coiffeurs, disponibilites, rendezVous] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true }, select: { id: true, nom: true, prenom: true } }),
    prisma.disponibilite.findMany(),
    prisma.rendezVous.findMany({
      where: { date: { gte: from, lte: to } },
      include: { service: { select: { prix: true, duree: true } } },
    }),
  ])

  const minutesDisponiblesParCoiffeur = new Map<string, number>()
  for (const date of eachDate(from, to)) {
    const jour = date.getUTCDay()
    for (const dispo of disponibilites) {
      if (dispo.jourSemaine !== jour) continue
      const minutes = timeToMinutes(dispo.heureFin) - timeToMinutes(dispo.heureDebut)
      minutesDisponiblesParCoiffeur.set(dispo.coiffeurId, (minutesDisponiblesParCoiffeur.get(dispo.coiffeurId) ?? 0) + minutes)
    }
  }
  const minutesDisponiblesTotal = [...minutesDisponiblesParCoiffeur.values()].reduce((a, b) => a + b, 0)

  const parCoiffeur = new Map<string, { rendezVous: number; minutesReservees: number; chiffreAffaires: number }>()
  let minutesReserveesTotal = 0
  let chiffreAffairesTotal = 0
  const parStatut: Record<string, number> = { EN_ATTENTE: 0, CONFIRME: 0, TERMINE: 0, ANNULE: 0 }

  for (const rdv of rendezVous) {
    parStatut[rdv.statut] = (parStatut[rdv.statut] ?? 0) + 1

    const entry = parCoiffeur.get(rdv.coiffeurId) ?? { rendezVous: 0, minutesReservees: 0, chiffreAffaires: 0 }
    entry.rendezVous += 1

    if (rdv.statut !== 'ANNULE') {
      entry.minutesReservees += rdv.service.duree
      minutesReserveesTotal += rdv.service.duree
    }
    if (rdv.statut === 'TERMINE') {
      const prix = Number(rdv.service.prix)
      entry.chiffreAffaires += prix
      chiffreAffairesTotal += prix
    }
    parCoiffeur.set(rdv.coiffeurId, entry)
  }

  const detailParCoiffeur = coiffeurs.map((c) => {
    const stats = parCoiffeur.get(c.id) ?? { rendezVous: 0, minutesReservees: 0, chiffreAffaires: 0 }
    const minutesDispo = minutesDisponiblesParCoiffeur.get(c.id) ?? 0
    return {
      id: c.id,
      nom: `${c.prenom} ${c.nom}`,
      rendezVous: stats.rendezVous,
      chiffreAffaires: stats.chiffreAffaires,
      tauxRemplissage: minutesDispo > 0 ? Math.min(1, stats.minutesReservees / minutesDispo) : 0,
    }
  })

  return {
    from,
    to,
    chiffreAffairesTotal,
    nombreRendezVous: rendezVous.length,
    parStatut,
    tauxRemplissageGlobal: minutesDisponiblesTotal > 0 ? Math.min(1, minutesReserveesTotal / minutesDisponiblesTotal) : 0,
    parCoiffeur: detailParCoiffeur,
  }
}
