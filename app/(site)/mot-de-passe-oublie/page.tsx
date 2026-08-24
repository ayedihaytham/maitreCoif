import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
}

export default function MotDePasseOubliePage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-md">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          Mot de passe <span className="text-gold">oublié</span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Saisissez votre email, nous vous enverrons un lien pour définir un nouveau mot de passe.
        </p>
        <div className="mt-10">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  )
}
