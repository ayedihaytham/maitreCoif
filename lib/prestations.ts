// Un rendez-vous peut regrouper plusieurs prestations (« Coupe » + « Barbe »).
// La durée est la somme des durées, le prix la somme des prix : les forfaits
// éventuels sont simplement des services comme les autres.
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
export { prestationsDuRendezVous, totaux, type TotauxPrestations } from '@/lib/prestations-utils'

export const MAX_PRESTATIONS = 5

type Db = Prisma.TransactionClient | typeof prisma

export interface Prestation {
  id: string
  nom: string
  prix: number
  duree: number
}

/** Identifiants sans doublon, dans l'ordre reçu, limités à MAX_PRESTATIONS. */
export function idsUniques(ids: string | string[]): string[] {
  const liste = Array.isArray(ids) ? ids : ids.split(',')
  return [...new Set(liste.map((i) => i.trim()).filter(Boolean))].slice(0, MAX_PRESTATIONS)
}

/** Services actifs demandés, dans l'ordre demandé ; null si l'un d'eux est introuvable ou inactif. */
export async function chargerPrestations(ids: string | string[], db: Db = prisma): Promise<Prestation[] | null> {
  const demandes = idsUniques(ids)
  if (demandes.length === 0) return null
  const services = await db.service.findMany({ where: { id: { in: demandes }, actif: true } })
  if (services.length !== demandes.length) return null
  return demandes.map((id) => {
    const s = services.find((x) => x.id === id)!
    return { id: s.id, nom: s.nom, prix: Number(s.prix), duree: s.duree }
  })
}

/** Sélection Prisma commune pour récupérer les prestations d'un rendez-vous. */
export const inclurePrestations = {
  service: { select: { id: true, nom: true, prix: true, duree: true } },
  lignes: { select: { serviceId: true, nom: true, prix: true, duree: true, ordre: true }, orderBy: { ordre: 'asc' as const } },
} satisfies Prisma.RendezVousInclude
