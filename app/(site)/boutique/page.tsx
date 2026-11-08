import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Catalogue } from '@/components/boutique/catalogue'
import { Cinema } from '@/components/site/cinema'
import { PageHero } from '@/components/site/page-hero'
import { chargerCatalogue } from '@/lib/boutique'

export const metadata: Metadata = {
  title: 'La boutique',
  description: 'Les produits de Maitre Coif : réservez en ligne, retirez et réglez au salon.',
}

// Le stock change à chaque réservation : on régénère souvent, et la réservation relit toujours la base.
export const revalidate = 30

export default async function BoutiquePage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams
  // Les packs vivent désormais dans « Nos services » : les anciens liens y mènent.
  if (vue === 'packs') redirect('/services?vue=packs')
  const { produits } = await chargerCatalogue()

  return (
    <main>
      <Cinema hud={false} />
      <PageHero
        etiquette="La boutique"
        image="/maitre-coif-interieur.jpg"
        lignes={[{ t: 'Les produits' }, { t: 'du salon.', or: true }]}
        texte="Choisissez en ligne, venez les retirer au salon. Réservation gratuite, sans paiement en ligne : vous réglez sur place, en dinars tunisiens (DT)."
        courte
      />
      <div className="wrap sec" style={{ paddingTop: 'clamp(40px,5vw,64px)' }}>
        <Catalogue produits={produits} />
      </div>
    </main>
  )
}
