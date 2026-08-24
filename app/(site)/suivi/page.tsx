import type { Metadata } from 'next'

import { SuiviLookup } from '@/components/reservation/suivi-lookup'

export const metadata: Metadata = {
  title: 'Suivi de réservation',
  description: 'Retrouvez votre rendez-vous avec votre code de suivi ou votre numéro de téléphone.',
}

export default function SuiviPage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-2xl">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Suivi</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          Suivre ma <span className="text-gold">réservation</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          Retrouvez le statut de votre rendez-vous à l&apos;aide de votre code de suivi ou de votre numéro de
          téléphone.
        </p>

        <div className="mt-12">
          <SuiviLookup />
        </div>
      </div>
    </main>
  )
}
