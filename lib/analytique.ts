// Chiffres d'audience du site public, lus dans PostHog (API de requêtes HogQL) pour la page
// « Analytique » du back-office. Côté serveur uniquement : la clé d'API personnelle ne doit jamais
// atteindre le navigateur. Chaque rubrique est lue par sa propre requête : si l'une échoue, les
// autres s'affichent quand même et l'erreur est signalée à l'administrateur.
import { maintenantSalon } from '@/lib/slots'

export type PeriodeJours = 7 | 30 | 90
export const PERIODES_ANALYTIQUE: { jours: PeriodeJours; libelle: string }[] = [
  { jours: 7, libelle: '7 jours' },
  { jours: 30, libelle: '30 jours' },
  { jours: 90, libelle: '90 jours' },
]

export function lirePeriode(valeur: string | undefined): PeriodeJours {
  return valeur === '7' ? 7 : valeur === '90' ? 90 : 30
}

interface ConfigPostHog {
  hote: string
  projet: string
  cle: string
}

/** Configuration de l'API de lecture, ou null tant qu'elle n'est pas renseignée. */
export function configurationPostHog(): ConfigPostHog | null {
  const cle = process.env.POSTHOG_PERSONAL_API_KEY?.trim()
  const projet = process.env.POSTHOG_PROJECT_ID?.trim()
  if (!cle || !projet) return null
  return { cle, projet, hote: (process.env.POSTHOG_API_HOST?.trim() || 'https://eu.posthog.com').replace(/\/$/, '') }
}

// ───────────────────────── Requêtes ─────────────────────────

/** Les requêtes, par rubrique. `jours` est un entier validé (7, 30 ou 90) : aucune saisie n'y entre. */
export function construireRequetes(jours: PeriodeJours) {
  const periode = `timestamp >= now() - INTERVAL ${jours} DAY`
  return {
    kpi: `SELECT
        count(DISTINCT if(event = '$pageview', person_id, NULL)),
        countIf(event = '$pageview'),
        countIf(event = 'reservation_confirmee'),
        count(DISTINCT if(event = '$pageview' AND properties.$pathname = '/reservation', person_id, NULL))
      FROM events WHERE event IN ('$pageview', 'reservation_confirmee') AND ${periode}`,
    serie: `SELECT toString(toDate(timestamp)) AS jour, count(DISTINCT person_id) AS visiteurs, count() AS pages_vues
      FROM events WHERE event = '$pageview' AND ${periode} GROUP BY jour ORDER BY jour`,
    pages: `SELECT properties.$pathname AS page, count() AS vues, count(DISTINCT person_id) AS visiteurs
      FROM events WHERE event = '$pageview' AND ${periode} GROUP BY page ORDER BY vues DESC LIMIT 8`,
    entonnoir: `SELECT stage, count() AS personnes FROM (
        SELECT person_id, max(multiIf(event = 'reservation_confirmee', 4, properties.etape = 'coordonnees', 3, properties.etape = 'creneau', 2, properties.etape = 'prestations', 1, 0)) AS stage
        FROM events WHERE event IN ('reservation_etape', 'reservation_confirmee') AND ${periode} GROUP BY person_id
      ) GROUP BY stage`,
    clics: `SELECT properties.cible AS cible, count() AS clics
      FROM events WHERE event = 'clic' AND ${periode} GROUP BY cible ORDER BY clics DESC LIMIT 8`,
    sources: `SELECT coalesce(nullif(properties.$referring_domain, ''), '$direct') AS source, count(DISTINCT person_id) AS visiteurs
      FROM events WHERE event = '$pageview' AND ${periode} GROUP BY source ORDER BY visiteurs DESC LIMIT 6`,
    appareils: `SELECT coalesce(nullif(properties.$device_type, ''), 'Inconnu') AS appareil, count(DISTINCT person_id) AS visiteurs
      FROM events WHERE event = '$pageview' AND ${periode} GROUP BY appareil ORDER BY visiteurs DESC LIMIT 5`,
    pays: `SELECT coalesce(nullif(properties.$geoip_country_name, ''), 'Inconnu') AS pays, count(DISTINCT person_id) AS visiteurs
      FROM events WHERE event = '$pageview' AND ${periode} GROUP BY pays ORDER BY visiteurs DESC LIMIT 6`,
  }
}
export type NomRequete = keyof ReturnType<typeof construireRequetes>
type Lignes = unknown[][]

const TTL_MS = 5 * 60 * 1000
const memoire = new Map<string, { jusqua: number; lignes: Lignes }>()

async function executer(config: ConfigPostHog, requete: string): Promise<Lignes> {
  const connu = memoire.get(requete)
  if (connu && connu.jusqua > Date.now()) return connu.lignes

  const res = await fetch(`${config.hote}/api/projects/${encodeURIComponent(config.projet)}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: requete } }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`PostHog a répondu ${res.status}${res.status === 401 || res.status === 403 ? ' (clé refusée : vérifiez la clé d’API personnelle et sa permission « Query read »)' : ''}${detail ? ` — ${detail}` : ''}`)
  }
  const json = (await res.json()) as { results?: Lignes }
  const lignes = Array.isArray(json.results) ? json.results : []
  memoire.set(requete, { jusqua: Date.now() + TTL_MS, lignes })
  return lignes
}

// ───────────────────────── Mise en forme ─────────────────────────

export interface Analytique {
  jours: PeriodeJours
  visiteurs: number
  pagesVues: number
  reservations: number
  /** Réservations confirmées / visiteurs, entre 0 et 1. */
  conversion: number
  serie: { jour: string; visiteurs: number; pagesVues: number }[]
  pages: { page: string; vues: number; visiteurs: number }[]
  entonnoir: { etape: string; personnes: number }[]
  clics: { cible: string; clics: number }[]
  sources: { source: string; visiteurs: number }[]
  appareils: { appareil: string; visiteurs: number }[]
  pays: { pays: string; visiteurs: number }[]
}

const nombre = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const texte = (v: unknown, defaut = '') => (v === null || v === undefined || v === '' ? defaut : String(v))

export const LIBELLES_PAGES: Record<string, string> = {
  '/': 'Accueil',
  '/services': 'Services',
  '/equipe': 'Notre équipe',
  '/galerie': 'Galerie',
  '/reservation': 'Réservation',
  '/suivi': 'Suivi de réservation',
  '/connexion': 'Connexion',
  '/inscription': 'Inscription',
  '/compte': 'Espace client',
}
export const LIBELLES_CLICS: Record<string, string> = {
  'reserver-accueil': 'Réserver · haut de l’accueil',
  'reserver-barre': 'Réserver · barre du haut',
  'reserver-menu': 'Réserver · menu mobile',
  'reserver-prestation': 'Réserver une prestation',
  'reserver-coiffeur': 'Réserver avec un coiffeur',
  'reserver-fin': 'Réserver · bas de l’accueil',
  'tous-les-services': 'Voir tous les services',
  'toute-la-galerie': 'Voir toute la galerie',
  'toute-l-equipe': 'Voir toute l’équipe',
  theme: 'Changement de thème',
}
const LIBELLES_APPAREILS: Record<string, string> = { Desktop: 'Ordinateur', Mobile: 'Téléphone', Tablet: 'Tablette' }
export const ETAPES_ENTONNOIR = ['Ont ouvert la réservation', 'Ont choisi un coiffeur', 'Ont choisi leurs prestations', 'Ont choisi un créneau', 'Réservation confirmée']

/** Une ligne par jour de la période, y compris les jours sans visite (à zéro). */
export function remplirSerie(brut: Analytique['serie'], jours: number, aujourdhuiISO: string): Analytique['serie'] {
  const parJour = new Map(brut.map((j) => [j.jour, j]))
  const fin = Date.parse(`${aujourdhuiISO}T00:00:00Z`)
  return Array.from({ length: jours }, (_, i) => {
    const jour = new Date(fin - (jours - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    return parJour.get(jour) ?? { jour, visiteurs: 0, pagesVues: 0 }
  })
}

/** Assemble les résultats bruts de PostHog ; une rubrique absente (requête en échec) devient vide. */
export function assembler(r: Partial<Record<NomRequete, Lignes>>, jours: PeriodeJours, aujourdhuiISO: string): Analytique {
  const [visiteurs, pagesVues, reservations, ouvertures] = (r.kpi?.[0] ?? []).map(nombre)

  // Entonnoir : chaque personne est comptée à toutes les étapes qu'elle a atteintes (étape maximale ≥ k).
  const parEtape = new Map((r.entonnoir ?? []).map((l) => [nombre(l[0]), nombre(l[1])]))
  const atteint = (k: number) => [...parEtape].filter(([etape]) => etape >= k).reduce((somme, [, n]) => somme + n, 0)
  const niveaux = [1, 2, 3, 4].map(atteint)
  // La première marche est la page de réservation ; elle ne peut pas être plus petite que la suivante.
  const entonnoir = [Math.max(nombre(ouvertures), niveaux[0] ?? 0), ...niveaux].map((personnes, i) => ({ etape: ETAPES_ENTONNOIR[i], personnes }))

  return {
    jours,
    visiteurs: visiteurs ?? 0,
    pagesVues: pagesVues ?? 0,
    reservations: reservations ?? 0,
    conversion: visiteurs ? Math.min(1, (reservations ?? 0) / visiteurs) : 0,
    serie: remplirSerie((r.serie ?? []).map((l) => ({ jour: texte(l[0]).slice(0, 10), visiteurs: nombre(l[1]), pagesVues: nombre(l[2]) })), jours, aujourdhuiISO),
    pages: (r.pages ?? []).map((l) => ({ page: texte(l[0], '/'), vues: nombre(l[1]), visiteurs: nombre(l[2]) })),
    entonnoir,
    clics: (r.clics ?? []).map((l) => ({ cible: texte(l[0], 'autre'), clics: nombre(l[1]) })),
    sources: (r.sources ?? []).map((l) => ({ source: texte(l[0], '$direct'), visiteurs: nombre(l[1]) })),
    appareils: (r.appareils ?? []).map((l) => ({ appareil: LIBELLES_APPAREILS[texte(l[0])] ?? texte(l[0], 'Inconnu'), visiteurs: nombre(l[1]) })),
    pays: (r.pays ?? []).map((l) => ({ pays: texte(l[0], 'Inconnu'), visiteurs: nombre(l[1]) })),
  }
}

export type ResultatAnalytique =
  | { etat: 'non_configure' }
  | { etat: 'ok'; donnees: Analytique; erreurs: string[] }

export async function getAnalytique(jours: PeriodeJours): Promise<ResultatAnalytique> {
  const config = configurationPostHog()
  if (!config) return { etat: 'non_configure' }

  const requetes = construireRequetes(jours)
  const noms = Object.keys(requetes) as NomRequete[]
  const reponses = await Promise.allSettled(noms.map((nom) => executer(config, requetes[nom])))

  const lignes: Partial<Record<NomRequete, Lignes>> = {}
  const erreurs: string[] = []
  reponses.forEach((rep, i) => {
    if (rep.status === 'fulfilled') lignes[noms[i]] = rep.value
    else erreurs.push(`${noms[i]} : ${rep.reason instanceof Error ? rep.reason.message : String(rep.reason)}`)
  })
  if (erreurs.length) console.error('[analytique] requêtes PostHog en échec :', erreurs)

  return { etat: 'ok', donnees: assembler(lignes, jours, maintenantSalon().dateISO), erreurs }
}

/** Vide la mémoire des requêtes (tests). */
export function viderMemoireAnalytique() {
  memoire.clear()
}
