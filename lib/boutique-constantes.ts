// Constantes et calcul de prix de la boutique, sans aucune dépendance serveur : utilisables aussi
// bien par les pages du navigateur (panier, formulaire de pack) que par la base de données.

/** Une réservation non retirée expire au bout de ce nombre de jours. */
export const DELAI_RETRAIT_JOURS = 7
/** Quantité maximale d'un même article dans une réservation. */
export const QUANTITE_MAX = 10
/** À partir de ce stock, le produit est signalé « stock bas ». */
export const SEUIL_STOCK_BAS = 3

export type TypeRemise = 'POURCENTAGE' | 'PRIX_FIXE'

export const arrondir = (n: number) => Math.round(n * 100) / 100

export interface ElementPrix {
  quantite: number
  prix: number
}

export interface PrixPack {
  normal: number
  final: number
  economie: number
  /** Remise arrondie à l'entier, pour le badge « −15 % ». */
  pourcentage: number
}

/**
 * Prix d'un pack : somme des prix normaux, puis remise en pourcentage ou prix fixe.
 * Un prix fixe supérieur au prix normal ne produit pas de remise (jamais de prix gonflé).
 */
export function prixPack(elements: ElementPrix[], remiseType: TypeRemise, remiseValeur: number): PrixPack {
  const normal = arrondir(elements.reduce((s, e) => s + e.prix * e.quantite, 0))
  const brut = remiseType === 'POURCENTAGE' ? normal * (1 - Math.min(100, Math.max(0, remiseValeur)) / 100) : remiseValeur
  const final = Math.max(0, Math.min(normal, arrondir(brut)))
  const economie = arrondir(normal - final)
  return { normal, final, economie, pourcentage: normal > 0 ? Math.round((economie / normal) * 100) : 0 }
}
