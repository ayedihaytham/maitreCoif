import type { Metadata } from 'next'
import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Connexion',
}

export default function ConnexionPage() {
  return (
    <main>
      <div className="wrap page-head sec">
        <div className="auth-wrap">
          <div className="lbl">Espace client</div>
          <h1 className="page-h1">
            <em>Connexion.</em>
          </h1>
          <p className="lead">Connectez-vous pour retrouver vos rendez-vous et gérer votre compte.</p>
          <div style={{ marginTop: 40 }}>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  )
}
