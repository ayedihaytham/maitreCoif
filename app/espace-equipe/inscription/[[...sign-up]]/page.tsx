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
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace équipe</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          <span className="text-gold">Créer mon accès</span>
        </h1>
        <div className="mt-10">
          {!configure ? (
            <p className="text-sm text-muted-foreground">
              L&apos;authentification de l&apos;équipe n&apos;est pas configurée sur ce déploiement (clés Clerk manquantes).
            </p>
          ) : estPremiereEtape && !invite ? (
            <div className="max-w-sm text-center">
              <p className="text-sm leading-6 text-muted-foreground">
                L&apos;inscription se fait uniquement sur invitation. Demandez au gérant de vous inviter depuis la page
                « Équipe » : vous recevrez un email avec un lien personnel.
              </p>
              <Link href="/connexion" className="mt-6 inline-block text-[11px] text-gold hover:text-foreground">
                J&apos;ai déjà un accès : me connecter
              </Link>
            </div>
          ) : (
            <SignUp path="/inscription" signInUrl="/connexion" fallbackRedirectUrl="/planning" />
          )}
        </div>
      </div>
    </main>
  )
}
