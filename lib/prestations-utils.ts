// Fonctions pures (sans accès base) : utilisables aussi côté navigateur.

export interface TotauxPrestations {
  nom: string
  prix: number
  duree: number
}

/** Durée, prix et libellé (« Coupe + Barbe ») d'une liste de prestations. */
export function totaux(prestations: { nom: string; prix: number | string | { toString(): string }; duree: number }[]): TotauxPrestations {
  return {
    nom: prestations.map((p) => p.nom).join(' + '),
    prix: prestations.reduce((s, p) => s + Number(p.prix), 0),
    duree: prestations.reduce((s, p) => s + p.duree, 0),
  }
}

/**
 * Prestations d'un rendez-vous déjà créé : les lignes enregistrées, sinon (très
 * anciens rendez-vous) le service unique d'origine.
 */
export function prestationsDuRendezVous(rdv: {
  lignes?: { nom: string; prix: unknown; duree: number; ordre: number }[]
  service: { nom: string; prix: unknown; duree: number }
}) {
  const lignes = rdv.lignes && rdv.lignes.length > 0 ? [...rdv.lignes].sort((a, b) => a.ordre - b.ordre) : [rdv.service]
  return totaux(lignes.map((l) => ({ nom: l.nom, prix: Number(l.prix), duree: l.duree })))
}

