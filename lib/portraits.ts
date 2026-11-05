/**
 * Portrait d'un membre de l'équipe. Le seed (et d'anciennes fiches) donnent à
 * tout le monde la même planche de 4 portraits : on en découpe un par
 * personne tant qu'il y en a, puis on passe au monogramme plutôt que de
 * répéter un visage. Une vraie photo téléversée par le gérant passe avant.
 */
export const PHOTO_PLANCHE = '/maitre-coif-team.png'

export type Portrait =
  | { type: 'planche'; position: 'tl' | 'bl' }
  | { type: 'photo'; src: string }
  | { type: 'monogramme'; initiales: string }

const POSITIONS_PLANCHE = ['tl', 'bl'] as const

function initiales(prenom: string, nom: string) {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
}

export function attribuerPortraits<T extends { prenom: string; nom: string; photo: string | null }>(
  membres: T[],
): (T & { portrait: Portrait })[] {
  let dejaDecoupes = 0

  return membres.map((m) => {
    let portrait: Portrait = { type: 'monogramme', initiales: initiales(m.prenom, m.nom) }

    if (m.photo === PHOTO_PLANCHE) {
      if (dejaDecoupes < POSITIONS_PLANCHE.length) portrait = { type: 'planche', position: POSITIONS_PLANCHE[dejaDecoupes] }
      dejaDecoupes++
    } else if (m.photo) {
      portrait = { type: 'photo', src: m.photo }
    }

    return { ...m, portrait }
  })
}
