import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Créer un compte',
}

export default function InscriptionPage() {
  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-md">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Mon compte</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          Créer un <span className="text-gold">compte</span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Un compte n&apos;est pas obligatoire pour réserver, mais il vous permet de retrouver l&apos;historique de
          vos rendez-vous et de laisser un avis.
        </p>
        <div className="mt-10">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href="/connexion" className="text-gold hover:text-foreground">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
