'use client'

// Façade du suivi d'audience (PostHog) pour le site public. Tant que PostHog n'est pas configuré
// (pas de clé), ou avant son démarrage, tout est ignoré : on peut donc appeler suivre() partout
// sans condition.
import posthog from 'posthog-js'

export const POSTHOG_ACTIF = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)

/** Enregistre une interaction. N'envoyer ici aucune donnée personnelle (nom, téléphone, email, code de suivi). */
export function suivre(evenement: string, proprietes?: Record<string, string | number | boolean>) {
  if (!POSTHOG_ACTIF || !posthog.__loaded) return
  posthog.capture(evenement, proprietes)
}

const CLE_PERSONNEL = 'mc-equipe'

/** Vrai si ce navigateur a déjà été reconnu comme celui d'un membre de l'équipe (drapeau local, sans identifiant). */
export function navigateurDePersonnel(): boolean {
  try {
    return localStorage.getItem(CLE_PERSONNEL) === '1'
  } catch {
    return false
  }
}

/**
 * À appeler avec le rôle de la session (ou null si personne n'est connecté). Les visites du personnel du
 * salon ne comptent pas dans l'audience : le navigateur est mémorisé, et le suivi ne démarre plus à la
 * visite suivante (la toute première page vue d'une session du personnel peut, elle, être comptée).
 */
export function signalerSession(role: string | null | undefined) {
  const personnel = role === 'COIFFEUR' || role === 'ADMIN'
  try {
    if (personnel) localStorage.setItem(CLE_PERSONNEL, '1')
    else localStorage.removeItem(CLE_PERSONNEL)
  } catch {
    // stockage indisponible : on s'en tient à l'arrêt du suivi pour cette visite
  }
  if (personnel && POSTHOG_ACTIF && posthog.__loaded && !posthog.has_opted_out_capturing()) posthog.opt_out_capturing()
}
