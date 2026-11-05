import { prisma } from '@/lib/prisma'
import { getGrilleJour, getJoursDisponibles, maintenantSalon } from '@/lib/slots'

export interface ProchaineDisponibilite {
  dateISO: string
  heure: string
  coiffeur: string
  /** 0 = aujourd'hui, 1 = demain... (jours civils du salon) */
  joursAvant: number
}

const JOUR_MS = 86_400_000

/**
 * Premier créneau libre de toute l'équipe pour la prestation la plus courte,
 * dans les `horizonJours` prochains jours. Sert à l'accueil (« Prochaine
 * disponibilité ») ; null s'il n'y a rien (équipe vide, tout complet).
 */
export async function prochaineDisponibilite(horizonJours = 14): Promise<ProchaineDisponibilite | null> {
  const [coiffeurs, service] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      select: { id: true, prenom: true, nom: true },
    }),
    prisma.service.findFirst({ where: { actif: true }, orderBy: { duree: 'asc' } }),
  ])
  if (!service || coiffeurs.length === 0) return null

  const { dateISO: aujourdhui } = maintenantSalon()
  let meilleur: { dateISO: string; heure: string; coiffeur: string } | null = null

  for (const c of coiffeurs) {
    const jours = await getJoursDisponibles(c.id, service.id, aujourdhui, horizonJours)
    const premier = jours.find((j) => j.etat === 'libre')
    if (!premier) continue
    if (meilleur && premier.date > meilleur.dateISO) continue

    const libre = (await getGrilleJour(c.id, service.id, premier.date)).find((g) => g.libre)
    if (!libre) continue

    const plusTot =
      !meilleur || premier.date < meilleur.dateISO || (premier.date === meilleur.dateISO && libre.heure < meilleur.heure)
    if (plusTot) meilleur = { dateISO: premier.date, heure: libre.heure, coiffeur: `${c.prenom} ${c.nom}` }
  }

  if (!meilleur) return null
  const joursAvant = Math.round((Date.parse(`${meilleur.dateISO}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / JOUR_MS)
  return { ...meilleur, joursAvant }
}

/** « aujourd'hui », « demain » ou « vendredi 13 novembre ». */
export function libelleJour(dateISO: string, joursAvant: number): string {
  if (joursAvant === 0) return "aujourd'hui"
  if (joursAvant === 1) return 'demain'
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}
