// Horaires d'ouverture du salon, déduits des disponibilités de l'équipe active : le pied de page
// et le menu restent justes quand le salon ouvre un nouveau jour (ex. le dimanche).
import { cache } from 'react'

import { prisma } from '@/lib/prisma'

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const ORDRE = [1, 2, 3, 4, 5, 6, 0] // la semaine commence le lundi

export type LigneHoraire = { jours: string; heures: string }

type Dispo = { jourSemaine: number; heureDebut: string; heureFin: string }

const heure = (h: string) => h.replace(':', 'h') // "10:00" -> "10h00"

/** « Mardi — Dimanche », « Mardi, Jeudi », « Samedi » : les jours consécutifs sont regroupés. */
function libelleJours(jours: number[]): string {
  const rang = jours.map((j) => ORDRE.indexOf(j)).sort((a, b) => a - b)
  const blocs: number[][] = []
  for (const r of rang) {
    const dernier = blocs[blocs.length - 1]
    if (dernier && r === dernier[dernier.length - 1] + 1) dernier.push(r)
    else blocs.push([r])
  }
  return blocs
    .map((b) => (b.length >= 3 ? `${JOURS[ORDRE[b[0]]]} — ${JOURS[ORDRE[b[b.length - 1]]]}` : b.map((r) => JOURS[ORDRE[r]]).join(', ')))
    .join(', ')
}

/** Une ligne par amplitude horaire (ouverture la plus tôt, fermeture la plus tard parmi l'équipe). */
export function resumerHoraires(dispos: Dispo[]): LigneHoraire[] {
  const parJour = new Map<number, { debut: string; fin: string }>()
  for (const d of dispos) {
    const actuel = parJour.get(d.jourSemaine)
    parJour.set(d.jourSemaine, {
      debut: !actuel || d.heureDebut < actuel.debut ? d.heureDebut : actuel.debut,
      fin: !actuel || d.heureFin > actuel.fin ? d.heureFin : actuel.fin,
    })
  }
  const groupes = new Map<string, number[]>()
  for (const [jour, { debut, fin }] of parJour) {
    const cle = `${heure(debut)} — ${heure(fin)}`
    groupes.set(cle, [...(groupes.get(cle) ?? []), jour])
  }
  return [...groupes.entries()]
    .map(([heures, jours]) => ({ jours: libelleJours(jours), heures, premier: Math.min(...jours.map((j) => ORDRE.indexOf(j))) }))
    .sort((a, b) => a.premier - b.premier)
    .map(({ jours, heures }) => ({ jours, heures }))
}

/** Lecture dédupliquée par requête (en-tête et pied de page). Jamais bloquant : repli sur une liste vide. */
export const getHorairesSalon = cache(async (): Promise<LigneHoraire[]> => {
  try {
    const dispos = await prisma.disponibilite.findMany({
      where: { coiffeur: { actif: true, role: { in: ['COIFFEUR', 'ADMIN'] } } },
      select: { jourSemaine: true, heureDebut: true, heureFin: true },
    })
    return resumerHoraires(dispos)
  } catch {
    return []
  }
})
