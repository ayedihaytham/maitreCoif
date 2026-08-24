import type { Metadata } from 'next'
import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Connexion',
}

export default function ConnexionPage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-md">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          <span className="text-gold">Connexion</span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Réservé aux coiffeurs, à l&apos;administrateur et aux clients disposant d&apos;un compte.
        </p>
        <div className="mt-10">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
