import type { Metadata } from 'next'

import { StaffSignOutButton } from '@/components/auth/staff-sign-out'

export const metadata: Metadata = {
  title: 'Accès refusé',
}

// Rendu à la demande : le bouton dépend de la session Clerk, absente au build.
export const dynamic = 'force-dynamic'

export default function AccesRefusePage() {
  return (
    <main className="es-main">
      <div className="lbl">Régie · Accès équipe</div>
      <h1>
        Accès <em>refusé.</em>
      </h1>
      <p className="es-lead">
        Ce compte est bien connecté, mais son adresse email n&apos;est pas celle d&apos;un membre actif de l&apos;équipe.
        Demandez à l&apos;administrateur du salon de vérifier votre fiche dans « Équipe », ou connectez-vous avec une autre adresse.
      </p>
      <div className="es-card">
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (
          <StaffSignOutButton redirectUrl="/connexion" variant="outline" label="Changer de compte" />
        )}
      </div>
    </main>
  )
}
