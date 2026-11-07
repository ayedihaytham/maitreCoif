import type { Metadata } from 'next'

import { PanierView } from '@/components/boutique/panier-view'

export const metadata: Metadata = {
  title: 'Mon panier',
  description: 'Confirmez votre réservation de produits et de packs chez Maitre Coif.',
  robots: { index: false, follow: false },
}

export default function PanierPage() {
  return (
    <main>
      <div className="wrap page-head sec">
        <div className="lbl">Boutique · Mon panier</div>
        <h1 className="page-h1">
          Ma <em>réservation.</em>
        </h1>
        <p className="lead">Vérifiez vos articles, laissez-nous vos coordonnées : nous les mettons de côté et vous prévenons par email. Vous réglez au salon.</p>
        <PanierView />
      </div>
    </main>
  )
}
