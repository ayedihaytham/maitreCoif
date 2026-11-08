// Boutique : produits, packs et réservations de produits.
// Aucun paiement en ligne : le client réserve, retire et règle au salon.
//
// Ce fichier contient d'abord les calculs purs (prix d'un pack, quantités de stock
// à décompter), faciles à tester, puis les lectures et écritures en base.
import { Prisma, type Pack, type PackLigne, type Produit, type RendezVous, type Service } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { arrondir, DELAI_RETRAIT_JOURS, prixPack, QUANTITE_MAX, type PrixPack, type TypeRemise } from '@/lib/boutique-constantes'
import { creerRendezVousConfirme } from '@/lib/booking'
import { genererCodeSuiviUnique } from '@/lib/code-suivi'
import { chargerPrestations } from '@/lib/prestations'
import { creneauEstProposable, estDatePassee, maintenantSalon } from '@/lib/slots'

export { DELAI_RETRAIT_JOURS, QUANTITE_MAX, SEUIL_STOCK_BAS, prixPack, type TypeRemise, type PrixPack, type ElementPrix } from '@/lib/boutique-constantes'

// ───────────────────────── Calculs purs ─────────────────────────

/** Le jour civil `jourISO` (AAAA-MM-JJ) est-il dans la période de validité facultative d'un pack ? */
export function dansLaPeriode(debut: Date | null, fin: Date | null, jourISO: string): boolean {
  if (debut && debut.toISOString().slice(0, 10) > jourISO) return false
  if (fin && fin.toISOString().slice(0, 10) < jourISO) return false
  return true
}

export interface LigneStock {
  type: 'PRODUIT' | 'PACK'
  produitId: string | null
  quantite: number
  /** Contenu d'un pack (cf. CommandeLigne.detail). */
  detail?: unknown
}

export interface ElementDetail {
  type: 'produit' | 'service'
  produitId?: string | null
  serviceId?: string | null
  nom: string
  quantite: number
  prix: number
}

/** Lit le contenu figé d'un pack, en ignorant tout ce qui n'a pas la bonne forme. */
export function lireDetail(detail: unknown): ElementDetail[] {
  if (!Array.isArray(detail)) return []
  return detail.flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const { type, produitId, serviceId, nom, quantite, prix } = e as Record<string, unknown>
    if ((type !== 'produit' && type !== 'service') || typeof nom !== 'string') return []
    return [
      {
        type,
        produitId: typeof produitId === 'string' ? produitId : null,
        serviceId: typeof serviceId === 'string' ? serviceId : null,
        nom,
        quantite: typeof quantite === 'number' ? quantite : 1,
        prix: typeof prix === 'number' ? prix : 0,
      } satisfies ElementDetail,
    ]
  })
}

/** Quantité de stock à décompter (ou à rendre) par produit, produits des packs compris. */
export function quantitesParProduit(lignes: LigneStock[]): Map<string, number> {
  const quantites = new Map<string, number>()
  const ajouter = (id: string | null | undefined, q: number) => {
    if (id && q > 0) quantites.set(id, (quantites.get(id) ?? 0) + q)
  }
  for (const ligne of lignes) {
    if (ligne.type === 'PRODUIT') ajouter(ligne.produitId, ligne.quantite)
    else for (const e of lireDetail(ligne.detail)) if (e.type === 'produit') ajouter(e.produitId, e.quantite * ligne.quantite)
  }
  return quantites
}

// ───────────────────────── Catalogue public ─────────────────────────

export interface ProduitPublic {
  id: string
  nom: string
  description: string | null
  prix: number
  categorie: string | null
  stock: number
  image: string | null
}

export interface ElementPackPublic {
  type: 'produit' | 'service'
  id: string
  nom: string
  quantite: number
  prix: number
  /** Prestation : durée en minutes. */
  duree?: number
}

export interface PackPublic {
  id: string
  nom: string
  description: string | null
  elements: ElementPackPublic[]
  normal: number
  final: number
  economie: number
  pourcentage: number
  /** Dernier jour de validité (AAAA-MM-JJ), s'il y en a un. */
  fin: string | null
  /** Nombre de packs réservables avec le stock actuel. */
  disponibles: number
}

export function urlImageProduit(p: Pick<Produit, 'id' | 'image' | 'miseAJour'>): string | null {
  return p.image ? `/api/boutique/produits/${p.id}/image?v=${p.miseAJour.getTime()}` : null
}

const versProduitPublic = (p: Produit): ProduitPublic => ({
  id: p.id,
  nom: p.nom,
  description: p.description,
  prix: Number(p.prix),
  categorie: p.categorie,
  stock: p.stock,
  image: urlImageProduit(p),
})

type PackAvecLignes = Pack & { lignes: (PackLigne & { produit: Produit | null; service: Service | null })[] }

export const INCLURE_PACK = {
  lignes: { orderBy: { ordre: 'asc' as const }, include: { produit: true, service: true } },
} satisfies Prisma.PackInclude

export type RaisonIndisponible = 'desactive' | 'periode' | 'element-inactif' | 'rupture'

export interface EvaluationPack {
  elements: ElementPackPublic[]
  prix: PrixPack
  /** Raison pour laquelle le pack n'est pas proposé sur le site, ou null s'il l'est. */
  raison: RaisonIndisponible | null
  disponibles: number
}

/** Calcule le contenu, le prix et la disponibilité d'un pack à la date donnée. */
export function evaluerPack(pack: PackAvecLignes, jourISO: string): EvaluationPack {
  const elements: ElementPackPublic[] = []
  let inactif = false
  let disponibles = Number.POSITIVE_INFINITY
  for (const l of pack.lignes) {
    if (l.produit) {
      elements.push({ type: 'produit', id: l.produit.id, nom: l.produit.nom, quantite: l.quantite, prix: Number(l.produit.prix) })
      if (!l.produit.actif) inactif = true
      disponibles = Math.min(disponibles, Math.floor(l.produit.stock / l.quantite))
    } else if (l.service) {
      elements.push({ type: 'service', id: l.service.id, nom: l.service.nom, quantite: l.quantite, prix: Number(l.service.prix), duree: l.service.duree })
      if (!l.service.actif) inactif = true
    }
  }
  if (!Number.isFinite(disponibles)) disponibles = QUANTITE_MAX // aucun produit à décompter (prestations seules)

  let raison: RaisonIndisponible | null = null
  if (!pack.actif) raison = 'desactive'
  else if (elements.length === 0 || inactif) raison = 'element-inactif'
  else if (!dansLaPeriode(pack.debut, pack.fin, jourISO)) raison = 'periode'
  else if (disponibles < 1) raison = 'rupture'

  return { elements, prix: prixPack(elements, pack.remiseType, Number(pack.remiseValeur)), raison, disponibles: Math.max(0, disponibles) }
}

const versPackPublic = (pack: PackAvecLignes, ev: EvaluationPack): PackPublic => ({
  id: pack.id,
  nom: pack.nom,
  description: pack.description,
  elements: ev.elements,
  ...ev.prix,
  fin: pack.fin ? pack.fin.toISOString().slice(0, 10) : null,
  disponibles: ev.disponibles,
})

/** Ce que le site public montre : produits actifs et packs réellement réservables. */
export async function chargerCatalogue(): Promise<{ produits: ProduitPublic[]; packs: PackPublic[] }> {
  const jour = maintenantSalon().dateISO
  const [produits, packs] = await Promise.all([
    prisma.produit.findMany({ where: { actif: true }, orderBy: [{ categorie: 'asc' }, { nom: 'asc' }] }),
    prisma.pack.findMany({ where: { actif: true }, orderBy: { dateCreation: 'asc' }, include: INCLURE_PACK }),
  ])
  return {
    produits: produits.map(versProduitPublic),
    packs: packs.flatMap((p) => {
      const ev = evaluerPack(p, jour)
      return ev.raison ? [] : [versPackPublic(p, ev)]
    }),
  }
}

// ───────────────────────── Packs de prestations ─────────────────────────
// Un pack est un lot de prestations à prix remisé : il se réserve comme une prestation (même assistant de
// réservation, même rendez-vous), sans panier ni stock.

const MAX_PRESTATIONS_PACK = 5 // aligné sur lib/prestations.ts : un pack forme un seul rendez-vous

/** Pack composé uniquement de prestations (une fois chacune) : seul type réservable comme une prestation. */
const estPackDePrestations = (elements: ElementPackPublic[]) =>
  elements.length > 0 && elements.length <= MAX_PRESTATIONS_PACK && elements.every((e) => e.type === 'service' && e.quantite === 1)

/** Packs proposés sur le site : prestations seules, actifs, dans leur période de validité. */
export async function chargerPacksPrestations(): Promise<PackPublic[]> {
  const jour = maintenantSalon().dateISO
  const packs = await prisma.pack.findMany({ where: { actif: true }, orderBy: { dateCreation: 'asc' }, include: INCLURE_PACK })
  return packs.flatMap((p) => {
    const ev = evaluerPack(p, jour)
    return ev.raison || !estPackDePrestations(ev.elements) ? [] : [versPackPublic(p, ev)]
  })
}

export interface PackReservable {
  nom: string
  serviceIds: string[]
  /** Prix du pack / prix normal : appliqué à chaque prestation pour que le rendez-vous porte le prix remisé. */
  ratio: number
}

/** Revalide un pack choisi pour une réservation ; null s'il n'est plus réservable (désactivé, hors période...). */
export async function resoudrePackReservable(packId: string): Promise<PackReservable | null> {
  const pack = await prisma.pack.findUnique({ where: { id: packId }, include: INCLURE_PACK })
  if (!pack) return null
  const ev = evaluerPack(pack, maintenantSalon().dateISO)
  if (ev.raison || !estPackDePrestations(ev.elements)) return null
  return { nom: pack.nom, serviceIds: ev.elements.map((e) => e.id), ratio: ev.prix.normal > 0 ? ev.prix.final / ev.prix.normal : 1 }
}

// ───────────────────────── Panier et réservation ─────────────────────────

export interface LigneDemandee {
  type: 'produit' | 'pack'
  id: string
  quantite: number
}

export interface LignePanier {
  type: 'produit' | 'pack'
  id: string
  nom: string
  quantite: number
  prixUnitaire: number
  prixNormalUnitaire: number
  /** Quantité maximale réservable en ce moment. */
  max: number
  image: string | null
  /** Pack : contenu. */
  elements: ElementPackPublic[]
}

/** Prestations d'un pack du panier : elles donnent lieu à un rendez-vous, réservé en même temps. */
export interface RendezVousPanier {
  serviceIds: string[]
  nom: string
  /** Durée totale en minutes. */
  duree: number
  packNom: string
}

export interface PanierResolu {
  lignes: LignePanier[]
  /** Non nul quand le panier contient un pack avec prestation : le client doit choisir un créneau. */
  rendezVous: RendezVousPanier | null
  total: number
  economie: number
  /** Messages à montrer au client (article retiré, quantité réduite...). Non vide = réservation impossible telle quelle. */
  problemes: string[]
}

/** Regroupe les lignes identiques et écarte les quantités absurdes. */
function fusionner(demande: LigneDemandee[]): LigneDemandee[] {
  const fusion = new Map<string, LigneDemandee>()
  for (const l of demande) {
    const quantite = Math.floor(l.quantite)
    if (!Number.isFinite(quantite) || quantite < 1) continue
    const cle = `${l.type}:${l.id}`
    const existante = fusion.get(cle)
    if (existante) existante.quantite += quantite
    else fusion.set(cle, { type: l.type, id: l.id, quantite })
  }
  return [...fusion.values()]
}

/**
 * Valide un panier avec les données actuelles de la base : prix, stock, disponibilité.
 * Les prix envoyés par le navigateur ne sont jamais crus : seuls l'identifiant et la quantité comptent.
 */
export async function resoudrePanier(demande: LigneDemandee[]): Promise<PanierResolu> {
  const lignesDemandees = fusionner(demande)
  const jour = maintenantSalon().dateISO
  const idsProduits = lignesDemandees.filter((l) => l.type === 'produit').map((l) => l.id)
  const idsPacks = lignesDemandees.filter((l) => l.type === 'pack').map((l) => l.id)

  const [produits, packs] = await Promise.all([
    idsProduits.length ? prisma.produit.findMany({ where: { id: { in: idsProduits } } }) : [],
    idsPacks.length ? prisma.pack.findMany({ where: { id: { in: idsPacks } }, include: INCLURE_PACK }) : [],
  ])
  const parIdProduit = new Map(produits.map((p) => [p.id, p]))
  const parIdPack = new Map(packs.map((p) => [p.id, p]))

  const lignes: LignePanier[] = []
  const problemes: string[] = []
  let rendezVous: RendezVousPanier | null = null
  // Stock demandé par produit, tous articles confondus (un produit seul + le même dans un pack).
  const stockDemande = quantitesParProduit(
    lignesDemandees.flatMap((l): LigneStock[] => {
      if (l.type === 'produit') return [{ type: 'PRODUIT', produitId: l.id, quantite: l.quantite }]
      const pack = parIdPack.get(l.id)
      if (!pack) return []
      const detail = pack.lignes.flatMap((pl) => (pl.produit ? [{ type: 'produit', produitId: pl.produit.id, nom: pl.produit.nom, quantite: pl.quantite, prix: 0 }] : []))
      return [{ type: 'PACK', produitId: null, quantite: l.quantite, detail }]
    }),
  )

  for (const l of lignesDemandees) {
    if (l.type === 'produit') {
      const p = parIdProduit.get(l.id)
      if (!p || !p.actif) {
        problemes.push('Un article de votre panier n’est plus proposé : il a été retiré.')
        continue
      }
      if (p.stock < 1) {
        problemes.push(`« ${p.nom} » est en rupture de stock : il a été retiré.`)
        continue
      }
      const max = Math.min(QUANTITE_MAX, p.stock)
      if (l.quantite > max) problemes.push(`Il ne reste que ${p.stock} « ${p.nom} » : la quantité a été ajustée.`)
      lignes.push({
        type: 'produit',
        id: p.id,
        nom: p.nom,
        quantite: Math.min(l.quantite, max),
        prixUnitaire: Number(p.prix),
        prixNormalUnitaire: Number(p.prix),
        max,
        image: urlImageProduit(p),
        elements: [],
      })
    } else {
      const pack = parIdPack.get(l.id)
      const ev = pack ? evaluerPack(pack, jour) : null
      if (!pack || !ev || ev.raison) {
        problemes.push(`Le pack « ${pack?.nom ?? 'sélectionné'} » n’est plus disponible : il a été retiré.`)
        continue
      }
      const prestations = ev.elements.filter((e) => e.type === 'service')
      // Un pack avec prestation donne un rendez-vous : un seul par réservation, donc un seul pack de ce type, en un exemplaire.
      if (prestations.length > 0 && rendezVous) {
        problemes.push(`Une réservation ne peut contenir qu’un pack avec prestation : « ${pack.nom} » a été retiré. Réservez-le séparément.`)
        continue
      }
      const max = Math.min(QUANTITE_MAX, ev.disponibles, prestations.length > 0 ? 1 : QUANTITE_MAX)
      if (l.quantite > max) {
        problemes.push(
          prestations.length > 0
            ? `« ${pack.nom} » comprend une prestation : un seul exemplaire par réservation (un seul rendez-vous).`
            : `Il ne reste de quoi composer que ${ev.disponibles} « ${pack.nom} » : la quantité a été ajustée.`,
        )
      }
      if (prestations.length > 0) {
        rendezVous = {
          serviceIds: prestations.map((e) => e.id),
          nom: prestations.map((e) => e.nom).join(' + '),
          duree: prestations.reduce((t, e) => t + (e.duree ?? 0), 0),
          packNom: pack.nom,
        }
      }
      lignes.push({
        type: 'pack',
        id: pack.id,
        nom: pack.nom,
        quantite: Math.min(l.quantite, max),
        prixUnitaire: ev.prix.final,
        prixNormalUnitaire: ev.prix.normal,
        max,
        image: null,
        elements: ev.elements,
      })
    }
  }

  // Un même produit demandé seul et dans un pack peut dépasser le stock : on le signale.
  for (const [id, demande] of stockDemande) {
    const p = parIdProduit.get(id) ?? packs.flatMap((pk) => pk.lignes).find((pl) => pl.produit?.id === id)?.produit
    if (p && demande > p.stock) problemes.push(`Le stock de « ${p.nom} » (${p.stock}) ne suffit pas pour tout votre panier : réduisez les quantités.`)
  }

  const total = arrondir(lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0))
  const normal = arrondir(lignes.reduce((s, l) => s + l.prixNormalUnitaire * l.quantite, 0))
  return { lignes, rendezVous, total, economie: arrondir(normal - total), problemes }
}

// ───────────────────────── Création d'une réservation ─────────────────────────

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans caractères ambigus (0/O, 1/I)

/** Code d'une réservation : « PR- » suivi de 7 caractères (le préfixe du suivi des rendez-vous est « MC- »). */
export async function genererCodeCommandeUnique(): Promise<string> {
  const { randomInt } = await import('node:crypto')
  for (let essai = 0; essai < 10; essai++) {
    let code = ''
    for (let i = 0; i < 7; i++) code += ALPHABET[randomInt(ALPHABET.length)]
    const existant = await prisma.commande.findUnique({ where: { code: `PR-${code}` }, select: { id: true } })
    if (!existant) return `PR-${code}`
  }
  throw new Error('Impossible de générer un code de réservation unique')
}

export class StockInsuffisant extends Error {
  constructor(public produit: string) {
    super(`Stock insuffisant pour « ${produit} »`)
  }
}

export interface NouvelleCommande {
  clientNom: string
  clientTelephone: string
  clientEmail: string
  retrait: 'SALON' | 'RDV'
  jourSouhaite: string | null
  notes: string | null
  lignes: LigneDemandee[]
  /** Créneau choisi pour la prestation d'un pack (obligatoire si le panier en contient une). */
  rendezVous?: { coiffeurId: string; date: string; heureDebut: string } | null
}

export type ResultatCommande =
  | { ok: true; commande: CommandeComplete; rendezVous: RendezVous | null }
  | { ok: false; problemes: string[] }

/** Tout ce qu'il faut pour afficher ou notifier une réservation : lignes et rendez-vous lié (avec son coiffeur). */
export const INCLURE_COMMANDE = {
  lignes: true,
  rendezVous: { include: { coiffeur: { select: { prenom: true, nom: true } } } },
} satisfies Prisma.CommandeInclude

export type CommandeComplete = Prisma.CommandeGetPayload<{ include: typeof INCLURE_COMMANDE }>

/**
 * Enregistre une réservation : revalide le panier, décompte le stock (de façon atomique, donc sans
 * jamais passer sous zéro même avec deux clients simultanés) et fige les lignes.
 */
export async function creerCommande(entree: NouvelleCommande): Promise<ResultatCommande> {
  const panier = await resoudrePanier(entree.lignes)
  if (panier.lignes.length === 0) return { ok: false, problemes: panier.problemes.length ? panier.problemes : ['Votre panier est vide.'] }
  // Quantités ajustées ou articles retirés : le client doit d'abord voir le panier corrigé.
  if (panier.problemes.length > 0) return { ok: false, problemes: panier.problemes }

  // Pack avec prestation : on réserve d'abord le créneau (sans quoi la réservation n'a pas de sens).
  let rendezVous: RendezVous | null = null
  let retrait = entree.retrait
  let jourSouhaite = entree.jourSouhaite
  if (panier.rendezVous) {
    const choix = entree.rendezVous
    if (!choix) return { ok: false, problemes: [`Choisissez le créneau de la prestation de « ${panier.rendezVous.packNom} ».`] }
    if (estDatePassee(choix.date)) return { ok: false, problemes: ['Impossible de réserver une date déjà passée.'] }
    const coiffeur = await prisma.user.findFirst({ where: { id: choix.coiffeurId, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true } })
    const prestations = await chargerPrestations(panier.rendezVous.serviceIds)
    if (!coiffeur || !prestations) return { ok: false, problemes: ['Coiffeur ou prestation introuvable : choisissez à nouveau votre créneau.'] }
    if (!(await creneauEstProposable(choix.coiffeurId, panier.rendezVous.serviceIds, choix.date, choix.heureDebut))) {
      return { ok: false, problemes: ['Ce créneau n’est plus disponible, merci d’en choisir un autre.'] }
    }
    // Le rendez-vous porte la part de prestation du prix du pack (le chiffre d'affaires reste cohérent avec la remise).
    const lignePack = panier.lignes.find((l) => l.type === 'pack' && l.elements.some((e) => e.type === 'service'))
    const ratio = lignePack && lignePack.prixNormalUnitaire > 0 ? lignePack.prixUnitaire / lignePack.prixNormalUnitaire : 1
    rendezVous = await creerRendezVousConfirme({
      codeSuivi: await genererCodeSuiviUnique(),
      coiffeurId: choix.coiffeurId,
      prestations: prestations.map((p) => ({ ...p, prix: arrondir(p.prix * ratio) })),
      clientUserId: null,
      clientNom: entree.clientNom,
      clientTelephone: entree.clientTelephone,
      clientEmail: entree.clientEmail,
      date: choix.date,
      heureDebut: choix.heureDebut,
      notes: `Pack « ${panier.rendezVous.packNom} »`,
    })
    if (!rendezVous) return { ok: false, problemes: ['Ce créneau vient d’être réservé, merci d’en choisir un autre.'] }
    // Les produits attendent le client le jour de son rendez-vous.
    retrait = 'RDV'
    const jourTexte = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${choix.date}T00:00:00Z`))
    jourSouhaite = `${jourTexte} à ${choix.heureDebut}`
  }

  const code = await genererCodeCommandeUnique()
  const packs = await prisma.pack.findMany({ where: { id: { in: panier.lignes.filter((l) => l.type === 'pack').map((l) => l.id) } }, include: INCLURE_PACK })
  const parIdPack = new Map(packs.map((p) => [p.id, p]))

  const lignesAEnregistrer = panier.lignes.map((l) => {
    const detail: ElementDetail[] =
      l.type === 'pack'
        ? (parIdPack.get(l.id)?.lignes ?? []).flatMap<ElementDetail>((pl) =>
            pl.produit
              ? [{ type: 'produit' as const, produitId: pl.produit.id, nom: pl.produit.nom, quantite: pl.quantite, prix: Number(pl.produit.prix) }]
              : pl.service
                ? [{ type: 'service' as const, serviceId: pl.service.id, nom: pl.service.nom, quantite: pl.quantite, prix: Number(pl.service.prix) }]
                : [],
          )
        : []
    return {
      type: l.type === 'pack' ? ('PACK' as const) : ('PRODUIT' as const),
      produitId: l.type === 'produit' ? l.id : null,
      packId: l.type === 'pack' ? l.id : null,
      nom: l.nom,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      prixNormalUnitaire: l.prixNormalUnitaire,
      detail: l.type === 'pack' ? (detail as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    }
  })

  const aDecompter = quantitesParProduit(lignesAEnregistrer.map((l) => ({ type: l.type, produitId: l.produitId, quantite: l.quantite, detail: l.detail })))

  try {
    const commande = await prisma.$transaction(async (tx) => {
      for (const [produitId, quantite] of aDecompter) {
        // Condition dans la requête : deux réservations simultanées ne peuvent pas faire passer le stock sous zéro.
        const { count } = await tx.produit.updateMany({ where: { id: produitId, actif: true, stock: { gte: quantite } }, data: { stock: { decrement: quantite } } })
        if (count === 0) {
          const p = await tx.produit.findUnique({ where: { id: produitId }, select: { nom: true } })
          throw new StockInsuffisant(p?.nom ?? 'article')
        }
      }
      return tx.commande.create({
        data: {
          code,
          clientNom: entree.clientNom,
          clientTelephone: entree.clientTelephone,
          clientEmail: entree.clientEmail,
          retrait,
          jourSouhaite,
          rendezVousId: rendezVous?.id ?? null,
          notes: entree.notes,
          total: panier.total,
          economie: panier.economie,
          expireLe: new Date(Date.now() + DELAI_RETRAIT_JOURS * 24 * 60 * 60 * 1000),
          lignes: { create: lignesAEnregistrer },
        },
        include: INCLURE_COMMANDE,
      })
    })
    return { ok: true, commande, rendezVous }
  } catch (error) {
    // La réservation n'a pas abouti : le créneau pris pour elle est rendu.
    if (rendezVous) await prisma.rendezVous.delete({ where: { id: rendezVous.id } }).catch((e) => console.error('Créneau non libéré après échec de la réservation :', e))
    if (error instanceof StockInsuffisant) return { ok: false, problemes: [`« ${error.produit} » vient de n’être plus disponible en quantité suffisante. Vérifiez votre panier.`] }
    throw error
  }
}

// ───────────────────────── Statuts d'une réservation ─────────────────────────

export type StatutCommandeCible = 'PRETE' | 'RETIREE' | 'ANNULEE' | 'EXPIREE'

const ACTIVES = ['A_PREPARER', 'PRETE'] as const

/** Transitions permises depuis chaque statut (les statuts finaux n'en ont aucune). */
export const TRANSITIONS: Record<string, StatutCommandeCible[]> = {
  A_PREPARER: ['PRETE', 'RETIREE', 'ANNULEE', 'EXPIREE'],
  PRETE: ['RETIREE', 'ANNULEE', 'EXPIREE'],
  RETIREE: [],
  ANNULEE: [],
  EXPIREE: [],
}

export type ResultatStatut =
  | { ok: true; commande: CommandeComplete; precedent: string }
  | { ok: false; code: 'introuvable' | 'transition'; statut?: string }

/**
 * Change le statut d'une réservation. Une annulation ou une expiration rend le stock, dans la même
 * transaction ; la condition sur le statut actuel empêche de le rendre deux fois.
 */
export async function changerStatutCommande(id: string, cible: StatutCommandeCible): Promise<ResultatStatut> {
  const actuelle = await prisma.commande.findUnique({ where: { id }, include: INCLURE_COMMANDE })
  if (!actuelle) return { ok: false, code: 'introuvable' }
  if (!TRANSITIONS[actuelle.statut]?.includes(cible)) return { ok: false, code: 'transition', statut: actuelle.statut }

  const rendreLeStock = cible === 'ANNULEE' || cible === 'EXPIREE'
  const maintenant = new Date()
  const commande = await prisma.$transaction(async (tx) => {
    const { count } = await tx.commande.updateMany({
      where: { id, statut: actuelle.statut },
      data: {
        statut: cible,
        // « Prête » : le délai de retrait repart à partir de ce jour.
        ...(cible === 'PRETE' ? { preteLe: maintenant, rappelEnvoye: false, expireLe: new Date(maintenant.getTime() + DELAI_RETRAIT_JOURS * 24 * 60 * 60 * 1000) } : {}),
      },
    })
    if (count === 0) return null // quelqu'un d'autre vient de la modifier
    if (rendreLeStock) {
      for (const [produitId, quantite] of quantitesParProduit(actuelle.lignes)) {
        await tx.produit.updateMany({ where: { id: produitId }, data: { stock: { increment: quantite } } })
      }
    }
    // Annulée : le rendez-vous réservé avec le pack l'est aussi (un simple retard de retrait, lui, n'y touche pas).
    if (cible === 'ANNULEE' && actuelle.rendezVousId) {
      await tx.rendezVous.updateMany({ where: { id: actuelle.rendezVousId, statut: { in: ['EN_ATTENTE', 'CONFIRME'] } }, data: { statut: 'ANNULE' } })
    }
    return tx.commande.findUniqueOrThrow({ where: { id }, include: INCLURE_COMMANDE })
  })
  if (!commande) return { ok: false, code: 'transition', statut: (await prisma.commande.findUnique({ where: { id }, select: { statut: true } }))?.statut }
  return { ok: true, commande, precedent: actuelle.statut }
}

/** Réservations actives dont le délai de retrait est dépassé. */
export function commandesEchues(maintenant = new Date()) {
  return prisma.commande.findMany({ where: { statut: { in: [...ACTIVES] }, expireLe: { lt: maintenant } }, include: INCLURE_COMMANDE })
}

/** Réservations actives qui expirent dans les 24 prochaines heures et n'ont pas encore reçu leur rappel. */
export function commandesARappeler(maintenant = new Date()) {
  return prisma.commande.findMany({
    where: { statut: { in: [...ACTIVES] }, rappelEnvoye: false, expireLe: { gt: maintenant, lt: new Date(maintenant.getTime() + 24 * 60 * 60 * 1000) } },
    include: INCLURE_COMMANDE,
  })
}

/** Nombre de réservations à préparer (pastille de la barre latérale). */
export function nombreAPreparer() {
  return prisma.commande.count({ where: { statut: 'A_PREPARER' } })
}
