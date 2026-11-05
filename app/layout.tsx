import { ClerkProvider } from '@clerk/nextjs'
import { frFR } from '@clerk/localizations'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import { salonUrl } from '@/lib/salon-host'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })
// Italique chargé pour les citations et le bandeau défilant du site public.
const cormorant = Cormorant_Garamond({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-cormorant' })

export const metadata: Metadata = {
  title: {
    default: 'Maitre Coif — Salon de coiffure & barbier',
    template: '%s — Maitre Coif',
  },
  description: 'Réservez votre rendez-vous en ligne chez Maitre Coif, salon de coiffure & barbier à Sfax.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0A0A0A',
}

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
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const page = (
    <html lang="fr" className="bg-background">
      <body className={`${manrope.variable} ${cormorant.variable}`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )

  // Sans clés Clerk (preview, tests locaux) on ne monte pas le fournisseur :
  // le site public et l'espace client continuent de fonctionner.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return page
  return (
    <ClerkProvider
      localization={frFR}
      appearance={clerkAppearance}
      signInUrl={salonUrl('/connexion')}
      signUpUrl={salonUrl('/inscription')}
      signInFallbackRedirectUrl={salonUrl('/planning')}
      signUpFallbackRedirectUrl={salonUrl('/planning')}
    >
      {page}
    </ClerkProvider>
  )
}
