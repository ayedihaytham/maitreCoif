import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { chargerPrestations, totaux } from '@/lib/prestations'

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
export async function getCreneauxDisponibles(coiffeurId: string, serviceId: string | string[], dateISO: string) {
  return (await getGrilleJour(coiffeurId, serviceId, dateISO)).filter((c) => c.libre).map((c) => c.heure)
}

interface Plage {
  heureDebut: string
  heureFin: string
}

/** Pause déjeuner d'un coiffeur sous forme de plage occupée, ou null s'il n'en a pas. */
export function plagePause(u: { pauseDebut: string | null; pauseFin: string | null } | null | undefined): Plage | null {
  return u?.pauseDebut && u.pauseFin && u.pauseFin > u.pauseDebut ? { heureDebut: u.pauseDebut, heureFin: u.pauseFin } : null
}

export interface CreneauGrille {
  heure: string
  libre: boolean
}

/**
 * Grille des créneaux d'un jour (fonction pure) : pour chaque départ possible
 * (pas de 30 min dans les disponibilités du coiffeur, durée du service
 * incluse), indique s'il est libre. Un créneau est indisponible s'il est
 * déjà passé (aujourd'hui) ou chevauche un rendez-vous existant.
 */
export function construireGrille(
  disponibilites: Plage[],
  rendezVous: Plage[],
  duree: number,
  nowMinutes: number | null,
): CreneauGrille[] {
  const vus = new Set<string>()
  const grille: CreneauGrille[] = []

  for (const dispo of disponibilites) {
    const debut = timeToMinutes(dispo.heureDebut)
    const fin = timeToMinutes(dispo.heureFin)

    for (let start = debut; start + duree <= fin; start += SLOT_STEP_MINUTES) {
      const heure = minutesToTime(start)
      if (vus.has(heure)) continue
      vus.add(heure)

      const passe = nowMinutes !== null && start <= nowMinutes
      const end = start + duree
      const conflit = rendezVous.some((rdv) =>
        rangesOverlap(start, end, timeToMinutes(rdv.heureDebut), timeToMinutes(rdv.heureFin)),
      )
      grille.push({ heure, libre: !passe && !conflit })
    }
  }

  return grille.sort((a, b) => a.heure.localeCompare(b.heure))
}

/**
 * Grille d'un coiffeur pour un service et une date : créneaux libres ET
 * occupés (pour afficher les occupés barrés). Vide si la date est passée, le
 * salon/coiffeur est fermé ou le service inconnu.
 */
export async function getGrilleJour(coiffeurId: string, serviceId: string | string[], dateISO: string): Promise<CreneauGrille[]> {
  if (estDatePassee(dateISO)) return []

  const prestations = await chargerPrestations(serviceId)
  if (!prestations) return []
  const dureeTotale = totaux(prestations).duree
  if (await estFerme(coiffeurId, dateISO)) return []

  const date = new Date(`${dateISO}T00:00:00Z`)
  const jourSemaine = date.getUTCDay()

  const [disponibilites, rendezVousExistants, coiffeur] = await Promise.all([
    prisma.disponibilite.findMany({ where: { coiffeurId, jourSemaine } }),
    prisma.rendezVous.findMany({
      where: { coiffeurId, date, statut: { not: 'ANNULE' } },
      select: { heureDebut: true, heureFin: true },
    }),
    prisma.user.findUnique({ where: { id: coiffeurId }, select: { pauseDebut: true, pauseFin: true } }),
  ])

  // La pause déjeuner compte comme un créneau occupé : aucun rendez-vous ne la chevauche.
  const pause = plagePause(coiffeur)
  const { dateISO: aujourdhui, minutes } = maintenantSalon()
  return construireGrille(disponibilites, pause ? [...rendezVousExistants, pause] : rendezVousExistants, dureeTotale, dateISO === aujourdhui ? minutes : null)
}

export type EtatJour = 'libre' | 'complet' | 'ferme'

/**
 * État de chacun des `count` jours à partir de `fromISO` pour un coiffeur et
 * un service : « ferme » (pas d'horaires ce jour-là ou congé), « complet »
 * (horaires mais plus aucun créneau) ou « libre ». Quatre requêtes en tout,
 * quel que soit le nombre de jours.
 */
export async function getJoursDisponibles(
  coiffeurId: string,
  serviceId: string | string[],
  fromISO: string,
  count: number,
): Promise<{ date: string; etat: EtatJour }[]> {
  const debut = new Date(`${fromISO}T00:00:00Z`)
  const jours = Array.from({ length: count }, (_, i) => new Date(debut.getTime() + i * 86_400_000))
  const fin = jours[jours.length - 1]
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const prestations = await chargerPrestations(serviceId)
  if (!prestations) return jours.map((d) => ({ date: iso(d), etat: 'ferme' as const }))

  const [disponibilites, fermetures, rendezVous, coiffeur] = await Promise.all([
    prisma.disponibilite.findMany({ where: { coiffeurId } }),
    prisma.fermeture.findMany({
      where: { dateDebut: { lte: fin }, dateFin: { gte: debut }, OR: [{ coiffeurId: null }, { coiffeurId }] },
      select: { dateDebut: true, dateFin: true },
    }),
    prisma.rendezVous.findMany({
      where: { coiffeurId, date: { gte: debut, lte: fin }, statut: { not: 'ANNULE' } },
      select: { date: true, heureDebut: true, heureFin: true },
    }),
    prisma.user.findUnique({ where: { id: coiffeurId }, select: { pauseDebut: true, pauseFin: true } }),
  ])

  const pause = plagePause(coiffeur)
  const { dateISO: aujourdhui, minutes } = maintenantSalon()

  return jours.map((d) => {
    const dateISO = iso(d)
    if (estDatePassee(dateISO)) return { date: dateISO, etat: 'ferme' as const }
    if (fermetures.some((f) => f.dateDebut <= d && f.dateFin >= d)) return { date: dateISO, etat: 'ferme' as const }

    const dispos = disponibilites.filter((x) => x.jourSemaine === d.getUTCDay())
    if (dispos.length === 0) return { date: dateISO, etat: 'ferme' as const }

    const existants: Plage[] = rendezVous.filter((r) => iso(r.date) === dateISO)
    if (pause) existants.push(pause)
    const grille = construireGrille(dispos, existants, totaux(prestations).duree, dateISO === aujourdhui ? minutes : null)
    return { date: dateISO, etat: grille.some((c) => c.libre) ? ('libre' as const) : ('complet' as const) }
  })
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

  const pause = plagePause(await db.user.findUnique({ where: { id: coiffeurId }, select: { pauseDebut: true, pauseFin: true } }))
  if (pause && rangesOverlap(start, end, timeToMinutes(pause.heureDebut), timeToMinutes(pause.heureFin))) return false

  return !rendezVousExistants.some((rdv) =>
    rangesOverlap(start, end, timeToMinutes(rdv.heureDebut), timeToMinutes(rdv.heureFin)),
  )
}

/**
 * Le créneau demandé fait-il partie de ceux proposés au public ? Empêche de
 * réserver hors des horaires du coiffeur en appelant l'API directement.
 */
export async function creneauEstProposable(coiffeurId: string, serviceId: string | string[], dateISO: string, heureDebut: string) {
  return (await getCreneauxDisponibles(coiffeurId, serviceId, dateISO)).includes(heureDebut)
}
