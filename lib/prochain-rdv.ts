// Données du bloc « En direct » de la barre latérale du back-office : prochain rendez-vous
// et nombre de rendez-vous du jour. Un coiffeur voit les siens, le gérant ceux de toute l'équipe.
import { inclurePrestations, prestationsDuRendezVous } from '@/lib/prestations'
import { prisma } from '@/lib/prisma'
import { maintenantSalon, timeToMinutes } from '@/lib/slots'

export interface ProchainRdv {
  heure: string
  client: string
  prestations: string
  /** Renseigné pour le gérant uniquement (il voit toute l'équipe). */
  coiffeur: string | null
  /** « aujourd'hui » ou la date courte (ex. « ven. 6 nov. »). */
  jour: string
}

interface Candidat {
  date: string // AAAA-MM-JJ
  heureDebut: string
  heureFin: string
}

/** Premier rendez-vous qui n'est pas terminé à l'instant donné (liste triée par date puis heure). */
export function choisirProchain<T extends Candidat>(rdvs: T[], dateISO: string, minutes: number): T | null {
  return rdvs.find((r) => r.date > dateISO || (r.date === dateISO && timeToMinutes(r.heureFin) > minutes)) ?? null
}

export function libelleJour(dateRdv: string, dateISO: string): string {
  if (dateRdv === dateISO) return "aujourd'hui"
  return new Date(`${dateRdv}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export async function resumeSalon(user: { id: string; role: string }): Promise<{ prochain: ProchainRdv | null; aujourdhui: number }> {
  const { dateISO, minutes } = maintenantSalon()
  const jour = new Date(`${dateISO}T00:00:00Z`)
  const parCoiffeur = user.role === 'ADMIN' ? {} : { coiffeurId: user.id }

  const [aVenir, aujourdhui] = await Promise.all([
    prisma.rendezVous.findMany({
      where: { ...parCoiffeur, date: { gte: jour }, statut: { in: ['CONFIRME', 'EN_ATTENTE'] } },
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
      take: 40,
      include: { ...inclurePrestations, coiffeur: { select: { prenom: true } } },
    }),
    prisma.rendezVous.count({ where: { ...parCoiffeur, date: jour, statut: { not: 'ANNULE' } } }),
  ])

  const prochain = choisirProchain(
    aVenir.map((r) => ({ ...r, jourISO: r.date.toISOString().slice(0, 10), date: r.date.toISOString().slice(0, 10) })),
    dateISO,
    minutes,
  )

  return {
    aujourdhui,
    prochain: prochain
      ? {
          heure: prochain.heureDebut,
          client: prochain.clientNom,
          prestations: prestationsDuRendezVous(prochain).nom,
          coiffeur: user.role === 'ADMIN' ? prochain.coiffeur.prenom : null,
          jour: libelleJour(prochain.date, dateISO),
        }
      : null,
  }
}
