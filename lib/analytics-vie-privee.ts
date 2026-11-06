// Protection des données envoyées à PostHog : aucune donnée personnelle ne doit partir.
// Les adresses de certaines pages contiennent des secrets ou des identifiants (code de suivi d'un
// rendez-vous, jeton de réinitialisation de mot de passe) : on ne garde que les paramètres de
// campagne (utm_*) et on retire le reste avant tout envoi.

const PARAMETRES_CONSERVES = /^utm_(source|medium|campaign|term|content)$/i

/** Adresse sans paramètres sensibles ni fragment ; `utm_*` conservés. Une valeur qui n'est pas une adresse est rendue telle quelle. */
export function nettoyerUrl(valeur: string): string {
  if (!/^https?:\/\//i.test(valeur)) return valeur
  try {
    const u = new URL(valeur)
    for (const cle of [...u.searchParams.keys()]) if (!PARAMETRES_CONSERVES.test(cle)) u.searchParams.delete(cle)
    u.hash = ''
    return u.toString()
  } catch {
    return valeur.split(/[?#]/)[0]
  }
}

type Proprietes = Record<string, unknown>

const nettoyerObjet = (p: Proprietes | undefined): Proprietes | undefined => {
  if (!p) return p
  const copie: Proprietes = { ...p }
  for (const [cle, valeur] of Object.entries(copie)) if (typeof valeur === 'string' && /url|referrer/i.test(cle)) copie[cle] = nettoyerUrl(valeur)
  return copie
}

/** À brancher sur `before_send` de posthog-js : nettoie toutes les adresses de l'événement (y compris `$set` et `$set_once`). */
export function nettoyerEvenement<T extends { properties?: Proprietes; $set?: Proprietes; $set_once?: Proprietes }>(evenement: T | null): T | null {
  if (!evenement) return null
  return {
    ...evenement,
    properties: nettoyerObjet(evenement.properties),
    ...(evenement.$set ? { $set: nettoyerObjet(evenement.$set) } : {}),
    ...(evenement.$set_once ? { $set_once: nettoyerObjet(evenement.$set_once) } : {}),
  }
}
