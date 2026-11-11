import { StaffClerkForm } from '@/components/auth/staff-clerk-form'
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
      <div className="lbl">Espace salon · Accès équipe</div>
      <h1>
        Bienvenue dans <em>l&apos;espace salon.</em>
      </h1>
      <p className="es-lead">Réservé aux coiffeurs et à l&apos;administrateur du salon. L&apos;accès se fait sur invitation.</p>
      <div className="es-card">
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          // Pas de lien « S'inscrire » : l'accès se fait uniquement sur invitation.
          <StaffClerkForm mode="sign-in" masquerInscription />
        ) : (
          <p className="es-lead">L&apos;authentification de l&apos;équipe n&apos;est pas configurée sur ce déploiement (clés Clerk manquantes).</p>
        )}
      </div>
      <Link href={siteUrl('/')} className="es-back">
        Retour au site
      </Link>
    </main>
  )
}
