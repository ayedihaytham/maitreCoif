import '../cinema.css'
import '../cinema-chrome.css'
import './espace.css'

import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Gabarit volontairement minimal : cet espace est servi sur le sous-domaine du
// salon, où les pages du site public (Services, Suivi…) n'existent pas.
// Même langage visuel que le site : un plateau sombre, un cône de lumière, un cadre de viseur.
export default function EspaceSalonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mc es">
      <div className="es-light" aria-hidden="true" />
      <div className="es-vf tl" aria-hidden="true" />
      <div className="es-vf tr" aria-hidden="true" />
      <div className="es-vf bl" aria-hidden="true" />
      <div className="es-vf br" aria-hidden="true" />
      <header className="es-top">
        <Image src="/logo-gold.png" alt="Maitre Coif" width={376} height={310} priority />
        <span className="es-tag">
          Espace salon
        </span>
      </header>
      {children}
      <div className="h-grain" aria-hidden="true" />
    </div>
  )
}
