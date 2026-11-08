// Emplacement du salon pour la carte et l'itinéraire de l'accueil.
// NEXT_PUBLIC_SALON_MAP_QUERY peut contenir des coordonnées « lat,lng » (le plus fiable)
// ou le nom exact de la fiche Google Maps ; à défaut, on cherche par nom et adresse.

export const SALON_ADRESSE = 'Route Afran Km 5, Sfax, Tunisie'

const REQUETE = process.env.NEXT_PUBLIC_SALON_MAP_QUERY?.trim() || `Maitre Coif, ${SALON_ADRESSE}`

/** Carte intégrée (sans clé d'API). */
export const SALON_CARTE_URL = `https://www.google.com/maps?q=${encodeURIComponent(REQUETE)}&hl=fr&z=16&output=embed`

/** Itinéraire depuis la position de l'utilisateur (Google Maps l'ouvre dans l'appli sur mobile). */
export const SALON_ITINERAIRE_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(REQUETE)}&travelmode=driving`

/** Fiche du lieu sur Google Maps. */
export const SALON_FICHE_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(REQUETE)}`
