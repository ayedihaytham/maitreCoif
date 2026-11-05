import { SignIn } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'

import { siteUrl } from '@/lib/salon-host'

export const metadata: Metadata = {
  title: 'Espace équipe',
}

export const dynamic = 'force-dynamic'

export default function EspaceEquipePage() {
  return (
    <main className="es-main">
      <div className="lbl">Régie · Accès équipe</div>
      <h1>
        Prêt pour la <em>prise&nbsp;?</em>
      </h1>
      <p className="es-lead">Réservé aux coiffeurs et à l&apos;administrateur du salon. L&apos;accès se fait sur invitation.</p>
      <div className="es-card">
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          // Pas de lien « S'inscrire » : l'accès se fait uniquement sur invitation.
          <SignIn path="/connexion" fallbackRedirectUrl="/planning" appearance={{ elements: { footerAction: { display: 'none' } } }} />
        ) : (
          <p className="es-lead">L&apos;authentification de l&apos;équipe n&apos;est pas configurée sur ce déploiement (clés Clerk manquantes).</p>
        )}
      </div>
      <Link href={siteUrl('/connexion')} className="es-back">
        Vous êtes client ? Accédez à votre compte
      </Link>
    </main>
  )
}
