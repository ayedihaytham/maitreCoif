import type { Metadata } from 'next'

import { AdminPageHead } from '@/components/admin/page-head'
import { CommandesManager } from '@/components/admin/commandes-manager'
import { listerCommandesAdmin } from '@/lib/boutique-admin'
import { expirerCommandesEchues } from '@/lib/boutique-expiration'

export const metadata: Metadata = {
  title: 'Réservations produits',
}

export const dynamic = 'force-dynamic'

// Ouverte à tout le personnel (le contrôle d'accès est fait par le proxy et le layout) : les coiffeurs
// préparent et remettent aussi les commandes au salon.
export default async function AdminCommandesPage() {
  // Les réservations dont le délai est dépassé expirent maintenant (stock remis en vente) plutôt qu'à la prochaine tâche quotidienne.
  await expirerCommandesEchues().catch((e) => console.error('Expiration des réservations impossible :', e))
  return (
    <div>
      <AdminPageHead
        section="Boutique"
        titre={
          <>
            Les <em>réservations.</em>
          </>
        }
        description="Ce que les clients ont réservé en ligne. Préparez la commande, marquez-la « prête » (le client reçoit un email), puis « retirée » quand il est passé au salon."
      />
      <div className="ad-body">
        <CommandesManager initial={await listerCommandesAdmin()} />
      </div>
    </div>
  )
}
