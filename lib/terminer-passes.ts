// Un rendez-vous dont l'heure de fin est passée est « Terminé » sans intervention : plus besoin
// de le marquer à la main. Le marquage manuel reste utile pour un rendez-vous fini plus tôt que
// prévu. La mise à jour est faite à la lecture (planning, suivi, statistiques, compte) : sur
// l'hébergement gratuit, une tâche planifiée ne peut tourner qu'une fois par jour.
import { prisma } from '@/lib/prisma'
import { maintenantSalon, minutesToTime } from '@/lib/slots'

const INTERVALLE_MS = 30_000
let dernierPassage = 0

/** Passe en « Terminé » les rendez-vous confirmés ou en attente dont l'heure de fin est passée. */
export async function terminerRendezVousPasses({ forcer = false }: { forcer?: boolean } = {}): Promise<number> {
  // Une seule mise à jour toutes les 30 s par instance : les lectures fréquentes ne la répètent pas.
  if (!forcer && Date.now() - dernierPassage < INTERVALLE_MS) return 0
  dernierPassage = Date.now()

  try {
    const { dateISO, minutes } = maintenantSalon()
    const aujourdhui = new Date(`${dateISO}T00:00:00Z`)
    const maintenant = minutesToTime(minutes)
    const { count } = await prisma.rendezVous.updateMany({
      where: {
        statut: { in: ['CONFIRME', 'EN_ATTENTE'] },
        // Les heures sont des « HH:MM » à deux chiffres : la comparaison de texte suit l'ordre des heures.
        OR: [{ date: { lt: aujourdhui } }, { date: aujourdhui, heureFin: { lte: maintenant } }],
      },
      data: { statut: 'TERMINE' },
    })
    return count
  } catch (error) {
    // Ne jamais casser une page pour cela : la prochaine lecture réessaiera.
    console.error('Passage automatique en « Terminé » impossible :', error)
    dernierPassage = 0
    return 0
  }
}
