import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], variable: '--font-cormorant' })

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="bg-background">
      <body className={`${manrope.variable} ${cormorant.variable}`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
