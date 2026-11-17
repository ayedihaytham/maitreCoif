// Pays et ville du visiteur, déduits des en-têtes que Cloudflare ajoute à chaque requête
// (CF-IPCountry, et CF-IPCity si la règle « Add visitor location headers » est activée).
// Seuls le pays et la ville sont conservés : jamais l'adresse IP ni les coordonnées.

export interface LieuVisiteur {
  pays: string | null
  ville: string | null
}

// Codes spéciaux de Cloudflare : inconnu (XX) et réseau Tor (T1).
const CODES_IGNORES = new Set(['XX', 'T1'])

const nomsDePays = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' })
  } catch {
    return null
  }
})()

/** Nom français d'un pays à partir de son code (« TN » → « Tunisie ») ; null si le code est inconnu ou invalide. */
export function nomDePays(code: string | null | undefined): string | null {
  const c = code?.trim().toUpperCase()
  if (!c || !/^[A-Z]{2}$/.test(c) || CODES_IGNORES.has(c)) return null
  try {
    const nom = nomsDePays?.of(c)
    return nom && nom !== c ? nom : null
  } catch {
    return null
  }
}

/** Les en-têtes HTTP arrivent lus en latin1 : on retrouve les accents (« Zürich », « Tunis ») encodés en UTF-8. */
function decoderVille(brut: string): string {
  const t = brut.trim()
  try {
    return Buffer.from(t, 'latin1').toString('utf8').trim()
  } catch {
    return t
  }
}

export function lieuDepuisEntetes(entetes: Pick<Headers, 'get'>): LieuVisiteur {
  const pays = nomDePays(entetes.get('cf-ipcountry'))
  const brut = entetes.get('cf-ipcity')
  const ville = brut ? decoderVille(brut) : ''
  // Une ville n'a de sens qu'avec son pays ; on borne la taille par prudence.
  return { pays, ville: pays && ville && ville.length <= 80 && !/[<>]/.test(ville) ? ville : null }
}
