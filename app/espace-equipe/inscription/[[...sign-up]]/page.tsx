import { SignUp } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Créer mon accès équipe',
}

// Page d'arrivée des invitations envoyées depuis la page Équipe du back-office :
// Clerk y ajoute un jeton (__clerk_ticket). Sans jeton, il n'y a rien à créer :
// l'inscription libre est désactivée (en plus du mode « Restricted » de Clerk,
// qui est le vrai verrou côté serveur).
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ 'sign-up'?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InscriptionEquipePage({ params, searchParams }: Props) {
  const [{ 'sign-up': etapes }, requete] = await Promise.all([params, searchParams])
  // Les étapes suivantes du parcours (/inscription/continue, …) n'ont plus le jeton dans l'adresse.
  const estPremiereEtape = !etapes || etapes.length === 0
  const invite = Boolean(requete.__clerk_ticket)
  const configure = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <main className="es-main">
      <div className="lbl">Espace salon · Invitation</div>
      <h1>
        Créer mon <em>accès.</em>
      </h1>
      <div className="es-card">
        {!configure ? (
          <p className="es-lead">L&apos;authentification de l&apos;équipe n&apos;est pas configurée sur ce déploiement (clés Clerk manquantes).</p>
        ) : estPremiereEtape && !invite ? (
          <div>
            <p className="es-lead">
              L&apos;inscription se fait uniquement sur invitation. Demandez au gérant de vous inviter depuis la page
              « Équipe » : vous recevrez un email avec un lien personnel.
            </p>
            <Link href="/connexion" className="es-back" style={{ display: 'inline-block' }}>
              J&apos;ai déjà un accès : me connecter
            </Link>
          </div>
        ) : (
          <SignUp path="/inscription" signInUrl="/connexion" fallbackRedirectUrl="/planning" />
        )}
      </div>
    </main>
  )
}
