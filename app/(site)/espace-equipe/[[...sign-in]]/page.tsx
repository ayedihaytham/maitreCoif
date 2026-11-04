import { SignIn } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Espace équipe',
}

export default function EspaceEquipePage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          <span className="text-gold">Connexion</span>
        </h1>
        <p className="mt-4 text-center text-sm leading-6 text-muted-foreground">
          Réservé aux coiffeurs et à l&apos;administrateur du salon.
        </p>
        <div className="mt-10">
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <SignIn path="/espace-equipe" signUpUrl="/espace-equipe/inscription" fallbackRedirectUrl="/admin/planning" />
          ) : (
            <p className="text-sm text-muted-foreground">
              L&apos;authentification de l&apos;équipe n&apos;est pas configurée sur ce déploiement (clés Clerk manquantes).
            </p>
          )}
        </div>
        <Link href="/connexion" className="mt-8 text-[11px] text-muted-foreground hover:text-foreground">
          Vous êtes client ? Accédez à votre compte
        </Link>
      </div>
    </main>
  )
}
