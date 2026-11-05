import '../cinema.css'
import '../cinema-chrome.css'
import './espace.css'
import '../cinema-pro.css'

import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Gabarit volontairement minimal : cet espace est servi sur le sous-domaine du
// salon, où les pages du site public (Services, Suivi…) n'existent pas.
// Même charte que le site : fond sombre uni et accent doré.
export default function EspaceSalonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mc es">
      <header className="es-top">
        <Image src="/logo-gold.png" alt="Maitre Coif" width={376} height={310} priority />
        <span className="es-tag">
          Espace salon
        </span>
      </header>
      {children}
    </div>
  )
}
