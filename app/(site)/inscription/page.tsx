import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Créer un compte',
}

export default function InscriptionPage() {
  return (
    <main>
      <div className="wrap page-head sec">
        <div className="auth-wrap">
          <div className="lbl">Mon compte</div>
          <h1 className="page-h1">
            Créer <em>un compte.</em>
          </h1>
          <p className="lead">
            Un compte n&apos;est pas obligatoire pour réserver, mais il vous permet de retrouver l&apos;historique de vos
            rendez-vous et de laisser un avis.
          </p>
          <div style={{ marginTop: 40 }}>
            <RegisterForm />
          </div>
          <p className="form-foot" style={{ borderTop: 0, textAlign: 'center' }}>
            Déjà un compte ? <Link href="/connexion">Se connecter</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
