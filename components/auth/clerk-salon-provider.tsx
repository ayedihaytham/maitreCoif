import { ClerkProvider } from '@clerk/nextjs'
import { frFR } from '@clerk/localizations'

import { salonUrl } from '@/lib/salon-host'

// Thème Clerk aligné sur le site (fond sombre, accent doré).
const clerkAppearance = {
  variables: {
    colorPrimary: '#d4af37',
    colorBackground: '#1a1a1a',
    colorText: '#f5f3ee',
    colorTextSecondary: '#a09d96',
    colorInputBackground: '#0a0a0a',
    colorInputText: '#f5f3ee',
    colorDanger: '#e5484d',
    borderRadius: '0.125rem',
    fontFamily: 'var(--font-manrope), system-ui, sans-serif',
  },
  // Le formulaire Clerk prend l'allure d'un billet de cinéma : carte sombre, filet doré, titres en Cormorant.
  elements: {
    card: {
      backgroundColor: '#14120f',
      border: '1px solid rgba(212,175,55,.28)',
      boxShadow: '0 30px 80px rgba(0,0,0,.6), 0 0 80px rgba(255,243,214,.05)',
    },
    headerTitle: { fontFamily: 'var(--font-manrope), system-ui, sans-serif', fontWeight: 600, fontSize: '1.6rem' },
    formButtonPrimary: {
      textTransform: 'uppercase',
      letterSpacing: '.18em',
      fontSize: '.72rem',
      fontWeight: 700,
      color: '#0a0a0a',
    },
    formFieldLabel: { textTransform: 'uppercase', letterSpacing: '.16em', fontSize: '.66rem' },
    footer: { background: 'transparent' },
  },
}

/**
 * Fournisseur Clerk, monté seulement sur l'espace du personnel (back-office et connexion de
 * l'équipe). Les pages publiques n'en ont pas besoin : sans lui elles ne chargent aucun script
 * Clerk (plus légères et servies depuis le cache).
 * Sans clés Clerk (tests locaux), il ne monte rien.
 */
export function ClerkSalonProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <>{children}</>
  return (
    <ClerkProvider
      localization={frFR}
      appearance={clerkAppearance}
      signInUrl={salonUrl('/connexion')}
      signUpUrl={salonUrl('/inscription')}
      signInFallbackRedirectUrl={salonUrl('/planning')}
      signUpFallbackRedirectUrl={salonUrl('/planning')}
    >
      {children}
    </ClerkProvider>
  )
}
