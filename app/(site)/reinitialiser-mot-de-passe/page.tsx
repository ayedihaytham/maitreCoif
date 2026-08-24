import type { Metadata } from 'next'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Réinitialiser le mot de passe',
}

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-md">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          Nouveau <span className="text-gold">mot de passe</span>
        </h1>
        <div className="mt-10">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Lien de réinitialisation manquant ou invalide. Merci de refaire une demande depuis la page
              &quot;Mot de passe oublié&quot;.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
