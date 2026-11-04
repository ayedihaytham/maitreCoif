import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// Fuseau du salon : les dates/heures des rendez-vous sont des heures murales
// locales (ex. "10:00" = 10h à Tunis), pas de l'UTC.
const SALON_TIMEZONE = process.env.SALON_TIMEZONE || 'Africa/Tunis'

type DbClient = Prisma.TransactionClient | typeof prisma

/** Date et heure actuelles dans le fuseau du salon. */
export function maintenantSalon(now: Date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: SALON_TIMEZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const dateISO = `${parts.year}-${parts.month}-${parts.day}`
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  return { dateISO, minutes }
}

/**
 * Nombre d'heures entre maintenant et un rendez-vous (date civile + heure
 * murale du salon). Négatif si le rendez-vous est passé.
 */
export function heuresAvantRendezVous(dateISO: string, heureDebut: string, now: Date = new Date()): number {
  const { dateISO: aujourdhui, minutes } = maintenantSalon(now)
  const jours = (Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000
  return (jours * 1440 + timeToMinutes(heureDebut) - minutes) / 60
}

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

/** Une date (jour civil, sans l'heure) déjà entièrement passée, dans le fuseau du salon. */
export function estDatePassee(dateISO: string, now: Date = new Date()): boolean {
  return dateISO < maintenantSalon(now).dateISO
}

/** Le salon entier, ou ce coiffeur, est-il fermé (congé, jour férié...) ce jour-là ? */
export async function estFerme(coiffeurId: string, dateISO: string, db: DbClient = prisma): Promise<boolean> {
  const date = new Date(`${dateISO}T00:00:00Z`)
  const count = await db.fermeture.count({
    where: {
      dateDebut: { lte: date },
      dateFin: { gte: date },
      OR: [{ coiffeurId: null }, { coiffeurId }],
    },
  })
  return count > 0
}

/**
 * Calcule les créneaux libres d'un coiffeur pour un service et une date
 * donnés : intersecte ses disponibilités récurrentes du jour avec la durée
 * du service, puis exclut tout ce qui chevauche un rendez-vous existant
 * (y compris EN_ATTENTE, cf. règle de gestion "un créneau devient
 * indisponible dès qu'il est réservé").
 */
export async function getCreneauxDisponibles(coiffeurId: string, serviceId: string, dateISO: string) {
  if (estDatePassee(dateISO)) return []

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || !service.actif) return []
  if (await estFerme(coiffeurId, dateISO)) return []

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
  const { dateISO: aujourdhui, minutes: nowMinutes } = maintenantSalon()
  const isToday = dateISO === aujourdhui

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
  db: DbClient = prisma,
) {
  if (estDatePassee(dateISO)) return false
  if (await estFerme(coiffeurId, dateISO, db)) return false

  const date = new Date(`${dateISO}T00:00:00Z`)
  const rendezVousExistants = await db.rendezVous.findMany({
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

/**
 * Le créneau demandé fait-il partie de ceux proposés au public ? Empêche de
 * réserver hors des horaires du coiffeur en appelant l'API directement.
 */
export async function creneauEstProposable(coiffeurId: string, serviceId: string, dateISO: string, heureDebut: string) {
  return (await getCreneauxDisponibles(coiffeurId, serviceId, dateISO)).includes(heureDebut)
}
