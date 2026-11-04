import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Gabarit volontairement minimal : cet espace est servi sur le sous-domaine du
// salon, où les pages du site public (Services, Suivi…) n'existent pas.
export default function EspaceSalonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-5 py-4 sm:px-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Maitre Coif · Espace salon</p>
      </header>
      {children}
    </div>
  )
}
