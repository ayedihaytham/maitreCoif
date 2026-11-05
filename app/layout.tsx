import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
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

const THEME_SCRIPT = `try{var t=localStorage.getItem('mc-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
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
}
