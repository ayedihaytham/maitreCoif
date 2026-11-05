import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
}

export default function MotDePasseOubliePage() {
  return (
    <main>
      <div className="wrap page-head sec">
        <div className="auth-wrap">
          <div className="lbl">Espace client</div>
          <h1 className="page-h1">
            Mot de passe <em>oublié.</em>
          </h1>
          <p className="lead">Saisissez votre email, nous vous enverrons un lien pour définir un nouveau mot de passe.</p>
          <div style={{ marginTop: 40 }}>
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </main>
  )
}
