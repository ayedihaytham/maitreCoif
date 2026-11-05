// Un rendez-vous dont l'heure de fin est passée est « Terminé » sans intervention : plus besoin
// de le marquer à la main. Le marquage manuel reste utile pour un rendez-vous fini plus tôt que
// prévu. La mise à jour est faite à la lecture (planning, suivi, statistiques, compte) : sur
// l'hébergement gratuit, une tâche planifiée ne peut tourner qu'une fois par jour.
// Le client reçoit un email de remerciement, une seule fois, uniquement si le rendez-vous vient de
// se terminer (hier ou aujourd'hui) : les vieux rendez-vous sont simplement clos, sans courrier.
import { after } from 'next/server'

import { envoyerTermineEmail } from '@/lib/notifications'
import { inclurePrestations } from '@/lib/prestations'
import { prisma } from '@/lib/prisma'
import { detailsEmailClient } from '@/lib/rdv-emails'
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
    const hier = new Date(aujourdhui.getTime() - 86_400_000)
    const maintenant = minutesToTime(minutes)
    const actifs = ['CONFIRME', 'EN_ATTENTE'] as const
    // Les heures sont des « HH:MM » à deux chiffres : la comparaison de texte suit l'ordre des heures.
    const finis = { statut: { in: [...actifs] }, OR: [{ date: { lt: aujourdhui } }, { date: aujourdhui, heureFin: { lte: maintenant } }] }

    // 1. Les rendez-vous récents avec un email : un par un, pour n'écrire qu'à celui qui a réellement fait
    //    passer le statut (si deux instances passent en même temps, une seule envoie le remerciement).
    const recents = await prisma.rendezVous.findMany({
      where: { ...finis, clientEmail: { not: null }, date: { gte: hier } },
      include: { coiffeur: { select: { prenom: true, nom: true } }, ...inclurePrestations },
    })
    const aPrevenir: NonNullable<ReturnType<typeof detailsEmailClient>>[] = []
    let total = 0
    for (const r of recents) {
      const { count } = await prisma.rendezVous.updateMany({ where: { id: r.id, statut: { in: [...actifs] } }, data: { statut: 'TERMINE' } })
      total += count
      const details = count === 1 ? detailsEmailClient(r) : null
      if (details) aPrevenir.push(details)
    }

    // 2. Tout le reste (anciens rendez-vous, rendez-vous sans email) : en une seule requête.
    const { count } = await prisma.rendezVous.updateMany({ where: finis, data: { statut: 'TERMINE' } })
    total += count

    if (aPrevenir.length > 0) {
      const envoyer = async () => {
        for (const d of aPrevenir) await envoyerTermineEmail(d).catch((e) => console.error(`Échec de l'email « terminé » (${d.codeSuivi}) :`, e))
      }
      // Dans une requête : envoyé après la réponse, sans la ralentir. Hors requête (tests, scripts) : attendu.
      try {
        after(envoyer)
      } catch {
        await envoyer()
      }
    }
    return total
  } catch (error) {
    // Ne jamais casser une page pour cela : la prochaine lecture réessaiera.
    console.error('Passage automatique en « Terminé » impossible :', error)
    dernierPassage = 0
    return 0
  }
}
