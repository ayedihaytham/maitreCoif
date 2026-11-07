// Expiration des réservations de produits non retirées, et rappel 24 h avant.
// Appelée par la tâche planifiée quotidienne (cf. app/api/cron/rappels) et à chaque ouverture de la page
// « Réservations produits » du back-office : le stock est donc remis en vente sans attendre le lendemain.
import { changerStatutCommande, commandesARappeler, commandesEchues } from '@/lib/boutique'
import { notifierExpirationCommande, notifierRappelCommande } from '@/lib/boutique-emails'
import { prisma } from '@/lib/prisma'

/** Passe à « expirée » les réservations dont le délai est dépassé (stock rendu, client prévenu). Renvoie leur nombre. */
export async function expirerCommandesEchues(): Promise<number> {
  let expirees = 0
  for (const echue of await commandesEchues()) {
    const r = await changerStatutCommande(echue.id, 'EXPIREE')
    if (!r.ok) continue // modifiée entre-temps par quelqu'un d'autre
    expirees++
    await notifierExpirationCommande(r.commande)
  }
  return expirees
}

/** Prévient les clients dont les articles expirent dans moins de 24 h (une seule fois par réservation). */
export async function rappelerCommandes(): Promise<number> {
  let rappelees = 0
  for (const c of await commandesARappeler()) {
    // Marquée avant l'envoi : deux exécutions simultanées n'envoient pas deux fois le même rappel.
    const { count } = await prisma.commande.updateMany({ where: { id: c.id, rappelEnvoye: false }, data: { rappelEnvoye: true } })
    if (count === 0) continue
    rappelees++
    await notifierRappelCommande(c)
  }
  return rappelees
}
