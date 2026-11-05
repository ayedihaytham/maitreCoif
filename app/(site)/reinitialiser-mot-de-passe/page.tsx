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
    <main>
      <div className="wrap page-head sec">
        <div className="auth-wrap">
          <div className="lbl">Espace client</div>
          <h1 className="page-h1">
            Nouveau <em>mot de passe.</em>
          </h1>
          <div style={{ marginTop: 40 }}>
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <p className="notice">
                Lien de réinitialisation manquant ou invalide. Merci de refaire une demande depuis la page « Mot de passe
                oublié ».
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
