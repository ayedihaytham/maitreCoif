// Représentations « back-office » des produits, packs et réservations : ce que les pages de la régie
// et leurs routes API s'échangent (nombres plutôt que Decimal, dates en texte, jamais l'image elle-même).
import type { Prisma, Produit } from '@prisma/client'
import type { z } from 'zod'

import {
  evaluerPack,
  INCLURE_COMMANDE,
  INCLURE_PACK,
  lireDetail,
  prixPack,
  quantitesParProduit,
  urlImageProduit,
  type CommandeComplete,
  type ElementDetail,
  type PrixPack,
  type RaisonIndisponible,
} from '@/lib/boutique'
import { prisma } from '@/lib/prisma'
import { maintenantSalon } from '@/lib/slots'
import { formatPrix } from '@/lib/utils'
import type { packSchema } from '@/lib/validators'

export interface ProduitAdmin {
  id: string
  nom: string
  description: string | null
  prix: number
  categorie: string | null
  stock: number
  actif: boolean
  image: string | null
}

export const versProduitAdmin = (p: Produit): ProduitAdmin => ({
  id: p.id,
  nom: p.nom,
  description: p.description,
  prix: Number(p.prix),
  categorie: p.categorie,
  stock: p.stock,
  actif: p.actif,
  image: urlImageProduit(p),
})

export async function listerProduitsAdmin(): Promise<ProduitAdmin[]> {
  const produits = await prisma.produit.findMany({ orderBy: [{ actif: 'desc' }, { nom: 'asc' }] })
  return produits.map(versProduitAdmin)
}

export interface PackAdmin {
  id: string
  nom: string
  description: string | null
  remiseType: 'POURCENTAGE' | 'PRIX_FIXE'
  remiseValeur: number
  debut: string | null
  fin: string | null
  actif: boolean
  lignes: { type: 'produit' | 'service'; id: string; nom: string; quantite: number; prix: number }[]
  prix: PrixPack
  /** Pourquoi le pack n'est pas visible sur le site (null : il l'est). */
  raison: RaisonIndisponible | null
}

export type PackAvecContenu = Awaited<ReturnType<typeof chargerPacks>>[number]

function chargerPacks() {
  return prisma.pack.findMany({ orderBy: [{ actif: 'desc' }, { dateCreation: 'desc' }], include: INCLURE_PACK })
}

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export function versPackAdmin(p: PackAvecContenu, jourISO = maintenantSalon().dateISO): PackAdmin {
  const ev = evaluerPack(p, jourISO)
  return {
    id: p.id,
    nom: p.nom,
    description: p.description,
    remiseType: p.remiseType,
    remiseValeur: Number(p.remiseValeur),
    debut: jour(p.debut),
    fin: jour(p.fin),
    actif: p.actif,
    lignes: ev.elements,
    prix: ev.prix,
    raison: ev.raison,
  }
}

export async function listerPacksAdmin(): Promise<PackAdmin[]> {
  const jourISO = maintenantSalon().dateISO
  return (await chargerPacks()).map((p) => versPackAdmin(p, jourISO))
}

export interface CommandeAdmin {
  id: string
  code: string
  statut: 'A_PREPARER' | 'PRETE' | 'RETIREE' | 'ANNULEE' | 'EXPIREE'
  clientNom: string
  clientTelephone: string
  clientEmail: string
  retrait: 'SALON' | 'RDV'
  jourSouhaite: string | null
  notes: string | null
  total: number
  economie: number
  expireLe: string
  dateCreation: string
  lignes: { nom: string; quantite: number; type: 'PRODUIT' | 'PACK'; contenu: ElementDetail[] }[]
  /** Rendez-vous réservé avec le pack (date AAAA-MM-JJ, heure, coiffeur), s'il y en a un. */
  rendezVous: { date: string; heureDebut: string; coiffeur: string; statut: string } | null
}

export const versCommandeAdmin = (c: CommandeComplete): CommandeAdmin => ({
  id: c.id,
  code: c.code,
  statut: c.statut,
  clientNom: c.clientNom,
  clientTelephone: c.clientTelephone,
  clientEmail: c.clientEmail,
  retrait: c.retrait === 'RDV' ? 'RDV' : 'SALON',
  jourSouhaite: c.jourSouhaite,
  notes: c.notes,
  total: Number(c.total),
  economie: Number(c.economie),
  expireLe: c.expireLe.toISOString(),
  dateCreation: c.dateCreation.toISOString(),
  lignes: c.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, type: l.type, contenu: lireDetail(l.detail) })),
  rendezVous: c.rendezVous
    ? { date: c.rendezVous.date.toISOString().slice(0, 10), heureDebut: c.rendezVous.heureDebut, coiffeur: `${c.rendezVous.coiffeur.prenom} ${c.rendezVous.coiffeur.nom}`, statut: c.rendezVous.statut }
    : null,
})

export async function listerCommandesAdmin(): Promise<CommandeAdmin[]> {
  // Les plus récentes d'abord ; les 200 dernières suffisent (les plus anciennes sont de l'historique).
  const commandes = await prisma.commande.findMany({ orderBy: { dateCreation: 'desc' }, take: 200, include: INCLURE_COMMANDE })
  return commandes.map(versCommandeAdmin)
}

// ───────────────────────── Enregistrement d'un pack ─────────────────────────

export type DonneesPack = z.infer<typeof packSchema>

export type PackPrepare =
  | { ok: true; donnees: Omit<Prisma.PackUncheckedCreateInput, 'lignes'>; lignes: Omit<Prisma.PackLigneUncheckedCreateInput, 'packId'>[] }
  | { ok: false; erreur: string }

const jourOuNull = (j: string | null | undefined) => (j ? new Date(`${j}T00:00:00Z`) : null)

/**
 * Vérifie un pack saisi dans la régie : les éléments existent, ne sont pas en double, et un prix fixe
 * est bien inférieur au prix normal (sinon ce ne serait pas une remise).
 */
export async function preparerPack(d: DonneesPack): Promise<PackPrepare> {
  const cles = new Set<string>()
  for (const l of d.lignes) {
    const cle = `${l.type}:${l.id}`
    if (cles.has(cle)) return { ok: false, erreur: 'Un élément est présent deux fois : augmentez plutôt sa quantité.' }
    cles.add(cle)
  }
  // Un pack est un lot de prestations : elles forment un seul rendez-vous, une fois chacune.
  if (d.lignes.length > 5) return { ok: false, erreur: 'Un pack peut comprendre 5 prestations au maximum (elles forment un seul rendez-vous).' }
  const idsServices = d.lignes.map((l) => l.id)
  const services = await prisma.service.findMany({ where: { id: { in: idsServices } }, select: { id: true, prix: true } })
  if (services.length !== idsServices.length) return { ok: false, erreur: 'Une des prestations du pack est introuvable.' }

  const prix = new Map<string, number>(services.map((e) => [e.id, Number(e.prix)]))
  const normal = prixPack(d.lignes.map((l) => ({ quantite: l.quantite, prix: prix.get(l.id) ?? 0 })), 'POURCENTAGE', 0).normal
  if (d.remiseType === 'PRIX_FIXE' && d.remiseValeur >= normal) {
    return { ok: false, erreur: `Le prix du pack (${formatPrix(d.remiseValeur)}) doit être inférieur au prix normal de ses prestations (${formatPrix(normal)}).` }
  }

  return {
    ok: true,
    donnees: {
      nom: d.nom,
      description: d.description || null,
      remiseType: d.remiseType,
      remiseValeur: d.remiseValeur,
      debut: jourOuNull(d.debut),
      fin: jourOuNull(d.fin),
      actif: d.actif ?? true,
    },
    lignes: d.lignes.map((l, ordre) => ({
      ordre,
      quantite: l.quantite,
      produitId: null,
      serviceId: l.id,
    })),
  }
}

export async function chargerPackAdmin(id: string): Promise<PackAdmin | null> {
  const pack = await prisma.pack.findUnique({ where: { id }, include: INCLURE_PACK })
  return pack ? versPackAdmin(pack) : null
}

// ───────────────────────── Suppression d'un produit ─────────────────────────

export interface ImpactSuppressionProduit {
  /** Packs qui contiennent le produit. */
  packs: { id: string; nom: string }[]
  /** Réservations en cours (à préparer ou prêtes) qui contiennent le produit, seul ou dans un pack. */
  commandes: CommandeComplete[]
}

/** Ce qu'une suppression du produit changerait : packs touchés et réservations en cours à annuler. */
export async function impactSuppressionProduit(produitId: string): Promise<ImpactSuppressionProduit> {
  const [packs, enCours] = await Promise.all([
    prisma.pack.findMany({ where: { lignes: { some: { produitId } } }, select: { id: true, nom: true }, orderBy: { nom: 'asc' } }),
    prisma.commande.findMany({ where: { statut: { in: ['A_PREPARER', 'PRETE'] } }, include: INCLURE_COMMANDE }),
  ])
  return { packs, commandes: enCours.filter((c) => quantitesParProduit(c.lignes).has(produitId)) }
}
