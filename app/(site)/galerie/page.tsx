import type { Metadata } from 'next'

import { Cinema } from '@/components/site/cinema'
import { GalerieGrille } from '@/components/site/galerie-grille'
import { PageHero } from '@/components/site/page-hero'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Galerie',
  description: 'Les photos du salon Maitre Coif : le cadre, l’enseigne et nos réalisations.',
}

// Régénérée toutes les minutes : les photos ajoutées depuis le back-office apparaissent seules.
export const revalidate = 60

export default async function GaleriePage() {
  // Seuls l'identifiant et la légende sont lus : l'image elle-même est servie par /api/galerie/[id]/image.
  const photos = await prisma.photoSalon.findMany({
    orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }],
    select: { id: true, legende: true },
  })

  return (
    <main>
      <Cinema hud={false} />
      <PageHero
        courte
        etiquette="La galerie"
        image="/maitre-coif-interieur.jpg"
        lignes={[{ t: 'Le salon' }, { t: 'en images.', or: true }]}
        texte="Le cadre, l'enseigne et le travail de l'équipe : un aperçu de ce qui vous attend chez Maitre Coif."
      />
      <div className="wrap sec">
        {photos.length === 0 ? (
          <p className="empty-state">Les photos arrivent bientôt.</p>
        ) : (
          <GalerieGrille photos={photos} />
        )}
      </div>
    </main>
  )
}
