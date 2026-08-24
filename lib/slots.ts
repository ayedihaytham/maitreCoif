import { prisma } from '@/lib/prisma'

const SLOT_STEP_MINUTES = 30

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Calcule les créneaux libres d'un coiffeur pour un service et une date
 * donnés : intersecte ses disponibilités récurrentes du jour avec la durée
 * du service, puis exclut tout ce qui chevauche un rendez-vous existant
 * (y compris EN_ATTENTE, cf. règle de gestion "un créneau devient
 * indisponible dès qu'il est réservé").
 */
export async function getCreneauxDisponibles(coiffeurId: string, serviceId: string, dateISO: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || !service.actif) return []

  const date = new Date(`${dateISO}T00:00:00Z`)
  const jourSemaine = date.getUTCDay()

  const [disponibilites, rendezVousExistants] = await Promise.all([
    prisma.disponibilite.findMany({ where: { coiffeurId, jourSemaine } }),
    prisma.rendezVous.findMany({
      where: { coiffeurId, date, statut: { not: 'ANNULE' } },
      select: { heureDebut: true, heureFin: true },
    }),
  ])

  const duree = service.duree
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const creneaux: string[] = []

  for (const dispo of disponibilites) {
    const debut = timeToMinutes(dispo.heureDebut)
    const fin = timeToMinutes(dispo.heureFin)

    for (let start = debut; start + duree <= fin; start += SLOT_STEP_MINUTES) {
      if (isToday && start <= nowMinutes) continue

      const end = start + duree
      const conflit = rendezVousExistants.some((rdv) =>
        rangesOverlap(start, end, timeToMinutes(rdv.heureDebut), timeToMinutes(rdv.heureFin)),
      )
      if (!conflit) creneaux.push(minutesToTime(start))
    }
  }

  return creneaux
}

/**
 * Vérifie qu'un créneau demandé est toujours libre au moment de la
 * confirmation (évite une double réservation en cas de course entre deux
 * clients sur le même créneau).
 */
export async function creneauEstLibre(
  coiffeurId: string,
  dateISO: string,
  heureDebut: string,
  heureFin: string,
  excludeRendezVousId?: string,
) {
  const date = new Date(`${dateISO}T00:00:00Z`)
  const rendezVousExistants = await prisma.rendezVous.findMany({
    where: {
      coiffeurId,
      date,
      statut: { not: 'ANNULE' },
      ...(excludeRendezVousId ? { id: { not: excludeRendezVousId } } : {}),
    },
    select: { heureDebut: true, heureFin: true },
  })

  const start = timeToMinutes(heureDebut)
  const end = timeToMinutes(heureFin)

  return !rendezVousExistants.some((rdv) =>
    rangesOverlap(start, end, timeToMinutes(rdv.heureDebut), timeToMinutes(rdv.heureFin)),
  )
}
