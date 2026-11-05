'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Effets communs à tout le site public : apparition progressive des blocs
// (.rv) quand ils entrent à l'écran, et lueur dorée qui suit la souris sur
// les cartes (.spotlit). Aucune dépendance, désactivé par prefers-reduced-motion
// côté CSS pour l'apparition.
export function SiteEffects() {
  const pathname = usePathname()

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    const observer = () => document.querySelectorAll('.mc .rv:not(.in)').forEach((el) => io.observe(el))
    observer()
    // Les écrans rendus côté client (réservation, suivi) ajoutent des blocs après coup.
    const mo = new MutationObserver(observer)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      const el = (ev.target as Element | null)?.closest?.('.spotlit') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - r.left}px`)
      el.style.setProperty('--my', `${ev.clientY - r.top}px`)
    }
    document.addEventListener('mousemove', onMove, { passive: true })
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  return null
}
