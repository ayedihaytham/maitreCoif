// Compte à rebours jusqu'à un rendez-vous. Les rendez-vous sont des heures murales du salon
// (ex. « 17:30 » = 17h30 à Tunis), quel que soit le fuseau du visiteur : on compare donc
// l'heure murale du salon maintenant avec celle du rendez-vous, sans calcul de décalage.
const FUSEAU_SALON = 'Africa/Tunis'

/** Secondes écoulées depuis minuit (date civile du salon) de `maintenant`, avec la date. */
function murale(maintenant: Date, fuseau: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(maintenant)
      .map((x) => [x.type, x.value]),
  )
  return { dateISO: `${p.year}-${p.month}-${p.day}`, secondes: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) }
}

/** Secondes avant `heure` (HH:MM) le jour `dateISO` ; négatif si c'est passé. */
export function secondesAvant(dateISO: string, heure: string, maintenant: Date = new Date(), fuseau: string = FUSEAU_SALON): number {
  const now = murale(maintenant, fuseau)
  const [h, m] = heure.split(':').map(Number)
  const jours = (Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${now.dateISO}T00:00:00Z`)) / 86_400_000
  return jours * 86_400 + h * 3600 + m * 60 - now.secondes
}

export function decomposer(totalSecondes: number) {
  const s = Math.max(0, Math.floor(totalSecondes))
  return { jours: Math.floor(s / 86_400), heures: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), secondes: s % 60 }
}

export type EtatRendezVous =
  | { etat: 'avant'; reste: ReturnType<typeof decomposer>; total: number }
  | { etat: 'en_cours' }
  | { etat: 'passe' }

export function etatRendezVous(dateISO: string, debut: string, fin: string, maintenant: Date = new Date()): EtatRendezVous {
  const avantDebut = secondesAvant(dateISO, debut, maintenant)
  if (avantDebut > 0) return { etat: 'avant', reste: decomposer(avantDebut), total: avantDebut }
  return secondesAvant(dateISO, fin, maintenant) > 0 ? { etat: 'en_cours' } : { etat: 'passe' }
}
