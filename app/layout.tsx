import { ClerkProvider } from '@clerk/nextjs'
import { frFR } from '@clerk/localizations'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import { salonUrl } from '@/lib/salon-host'
import './globals.css'
import './theme.css'
import { ThemeSync } from '@/components/theme-toggle'

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
  colorScheme: 'dark light',
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

const THEME_SCRIPT = `try{var t=localStorage.getItem('mc-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const page = (
    <html lang="fr" className="bg-background" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Applique le thème choisi avant le premier affichage (sombre par défaut). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${manrope.variable} ${cormorant.variable}`}>
        <ThemeSync />
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
