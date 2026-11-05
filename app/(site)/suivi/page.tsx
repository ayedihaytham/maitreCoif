import type { Metadata } from 'next'

import { Cinema } from '@/components/site/cinema'
import { PageHero } from '@/components/site/page-hero'
import { SuiviLookup } from '@/components/reservation/suivi-lookup'

export const metadata: Metadata = {
  title: 'Suivi de réservation',
  description: 'Retrouvez votre rendez-vous avec votre code de suivi.',
}

export default async function SuiviPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams

  return (
    <main>
      <Cinema hud={false} />
      <PageHero
        courte
        etiquette="Suivi de réservation"
        scene="SC. 05 · SALLE DE PROJECTION"
        image="/maitre-coif-facade.jpg"
        lignes={[{ t: 'Retrouvez' }, { t: 'votre rendez-vous.', or: true }]}
        texte="Entrez le code de suivi reçu lors de la réservation : le statut de votre séance s'affiche aussitôt."
      />
      <div className="wrap sec">
        <SuiviLookup initialCode={code?.slice(0, 20) ?? ''} />
      </div>
    </main>
  )
}
