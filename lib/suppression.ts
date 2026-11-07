// Suppression définitive d'un membre de l'équipe ou d'un service qui figure dans des rendez-vous.
// Sans confirmation explicite, la suppression est refusée et on renvoie le détail de ce qui serait effacé.
// Avec confirmation (« en cascade »), les rendez-vous concernés sont supprimés avec leurs prestations,
// avis et demandes de modification, et les clients qui avaient un rendez-vous à venir sont prévenus
// de l'annulation par email.
import type { Prisma } from '@prisma/client'

import { envoyerAnnulationEmail } from '@/lib/notifications'
import { inclurePrestations } from '@/lib/prestations'
import { prisma } from '@/lib/prisma'
import { detailsEmailClient } from '@/lib/rdv-emails'

const ACTIFS = ['CONFIRME', 'EN_ATTENTE'] as const

export interface ApercuSuppression {
  total: number
  /** Rendez-vous encore actifs (confirmés ou en attente) : les clients seront prévenus. */
  aVenir: number
  /** Terminés ou annulés : leur historique et le chiffre d'affaires associé disparaissent. */
  passes: number
}

/** Rendez-vous d'un coiffeur. */
export const rendezVousDuCoiffeur = (coiffeurId: string): Prisma.RendezVousWhereInput => ({ coiffeurId })

/** Rendez-vous contenant un service (comme prestation principale ou comme l'une des prestations choisies). */
export const rendezVousDuService = (serviceId: string): Prisma.RendezVousWhereInput => ({
  OR: [{ serviceId }, { lignes: { some: { serviceId } } }],
})

export async function apercuSuppression(where: Prisma.RendezVousWhereInput): Promise<ApercuSuppression> {
  const [total, aVenir] = await Promise.all([
    prisma.rendezVous.count({ where }),
    prisma.rendezVous.count({ where: { AND: [where, { statut: { in: [...ACTIFS] } }] } }),
  ])
  return { total, aVenir, passes: total - aVenir }
}

/** Prévient par email les clients dont un rendez-vous actif va être supprimé. Renvoie le nombre d'emails partis. */
export async function prevenirClientsAnnulation(where: Prisma.RendezVousWhereInput): Promise<number> {
  const rdvs = await prisma.rendezVous.findMany({
    where: { AND: [where, { statut: { in: [...ACTIFS] } }, { clientEmail: { not: null } }] },
    include: { coiffeur: { select: { prenom: true, nom: true } }, ...inclurePrestations },
  })
  const envois = await Promise.allSettled(
    rdvs.map((r) => {
      const details = detailsEmailClient(r)
      return details ? envoyerAnnulationEmail({ ...details, parLeSalon: true }) : Promise.resolve(null)
    }),
  )
  let partis = 0
  envois.forEach((e, i) => {
    if (e.status === 'fulfilled') partis++
    else console.error(`Échec de l'email d'annulation (${rdvs[i].codeSuivi}) :`, e.reason)
  })
  return partis
}

/** Message d'erreur 409 quand des rendez-vous empêchent la suppression. */
export function messageRendezVousLies(sujet: string, a: ApercuSuppression) {
  return `${sujet} figure dans ${a.total} rendez-vous. Désactivez-le pour garder l'historique, ou confirmez la suppression définitive avec ses rendez-vous.`
}
