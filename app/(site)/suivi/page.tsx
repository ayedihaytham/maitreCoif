import type { Metadata } from 'next'

import { SuiviLookup } from '@/components/reservation/suivi-lookup'

export const metadata: Metadata = {
  title: 'Suivi de réservation',
  description: 'Retrouvez votre rendez-vous avec votre code de suivi.',
}

export default async function SuiviPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams

  return (
    <main>
      <div className="wrap page-head sec">
        <div className="lbl">Suivi de réservation</div>
        <h1 className="page-h1">
          Retrouvez <em>votre rendez-vous.</em>
        </h1>
        <p className="lead">
          Retrouvez le statut de votre rendez-vous à l&apos;aide de votre code de suivi (reçu lors de la réservation).
        </p>

        <SuiviLookup initialCode={code?.slice(0, 20) ?? ''} />
      </div>
    </main>
  )
}
