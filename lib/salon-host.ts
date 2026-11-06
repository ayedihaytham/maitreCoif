/**
 * L'espace sécurisé (back-office + connexion du personnel) est servi sur un
 * sous-domaine dédié, par ex. salon.maitrecoif.com, défini par
 * NEXT_PUBLIC_SALON_HOST. C'est la même application : le proxy réécrit les
 * adresses visibles du sous-domaine vers les routes internes /admin/* et
 * /espace-equipe/*, qui ne sont plus joignables depuis le site public.
 *
 *   salon.maitrecoif.com/planning     -> /admin/planning
 *   salon.maitrecoif.com/connexion    -> /espace-equipe
 *   salon.maitrecoif.com/inscription  -> /espace-equipe/inscription
 *
 * Sans NEXT_PUBLIC_SALON_HOST, le back-office est fermé (fail closed).
 */
export const SALON_HOST = (process.env.NEXT_PUBLIC_SALON_HOST ?? '').trim().toLowerCase()

const PAGES_SALON = ['planning', 'equipe', 'fermetures', 'services', 'galerie', 'statistiques', 'analytique']

/** Adresse visible du sous-domaine -> route interne, ou null si elle n'existe pas. */
export function versRouteInterne(pathname: string): string | null {
  const [premier, ...reste] = pathname.split('/').filter(Boolean)
  const suite = reste.length ? `/${reste.join('/')}` : ''

  switch (premier) {
    case 'connexion':
      return `/espace-equipe${suite}`
    case 'inscription':
      return `/espace-equipe/inscription${suite}`
    case 'acces-refuse':
      return reste.length === 0 ? '/espace-equipe/acces-refuse' : null
    default:
      return premier && reste.length === 0 && PAGES_SALON.includes(premier) ? `/admin/${premier}` : null
  }
}

/**
 * Ancienne adresse interne (/admin/..., /espace-equipe/...) -> adresse visible
 * sur le sous-domaine ; null si ce n'est pas une adresse de l'espace sécurisé.
 */
export function ancienneVersSalon(pathname: string): string | null {
  const [premier, deuxieme] = pathname.split('/').filter(Boolean)

  if (premier === 'admin') return deuxieme && PAGES_SALON.includes(deuxieme) ? `/${deuxieme}` : '/planning'
  if (premier === 'espace-equipe') {
    if (deuxieme === 'inscription') return '/inscription'
    if (deuxieme === 'acces-refuse') return '/acces-refuse'
    return '/connexion'
  }
  return null
}

export function estHoteSalon(host: string | null | undefined) {
  return SALON_HOST !== '' && host?.toLowerCase() === SALON_HOST
}

function origine(host: string) {
  const local = /(^|\.)localhost(:\d+)?$/.test(host)
  return `${local ? 'http' : 'https'}://${host}`
}

/** Adresse absolue sur le sous-domaine du salon. */
export function salonUrl(path = '/') {
  return SALON_HOST ? `${origine(SALON_HOST)}${path}` : path
}

/** Adresse absolue sur le site public (le sous-domaine sans son premier libellé). */
export function siteUrl(path = '/') {
  if (!SALON_HOST) return path
  const point = SALON_HOST.indexOf('.')
  return point === -1 ? path : `${origine(SALON_HOST.slice(point + 1))}${path}`
}
