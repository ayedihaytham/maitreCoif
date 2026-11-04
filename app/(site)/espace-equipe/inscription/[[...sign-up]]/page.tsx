import { SignUp } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer mon accès équipe',
}

// Page d'arrivée des invitations envoyées depuis /admin/equipe (Clerk y ajoute
// le jeton d'invitation). Hors invitation, l'inscription est refusée par Clerk.
export default function InscriptionEquipePage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          <span className="text-gold">Créer mon accès</span>
        </h1>
        <div className="mt-10">
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <SignUp path="/espace-equipe/inscription" signInUrl="/espace-equipe" fallbackRedirectUrl="/admin/planning" />
          ) : (
            <p className="text-sm text-muted-foreground">
              L&apos;authentification de l&apos;équipe n&apos;est pas configurée sur ce déploiement (clés Clerk manquantes).
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
