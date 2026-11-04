import type { Metadata } from 'next'

import { StaffSignOutButton } from '@/components/auth/staff-sign-out'

export const metadata: Metadata = {
  title: 'Accès refusé',
}

export default function AccesRefusePage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-md">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          <span className="text-gold">Accès refusé</span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Ce compte est bien connecté, mais son adresse email n&apos;est pas celle d&apos;un membre actif de l&apos;équipe.
          Demandez à l&apos;administrateur du salon de vérifier votre fiche dans « Équipe », ou connectez-vous avec une autre adresse.
        </p>
        <div className="mt-8">
          <StaffSignOutButton redirectUrl="/espace-equipe" variant="outline" label="Changer de compte" />
        </div>
      </div>
    </main>
  )
}
