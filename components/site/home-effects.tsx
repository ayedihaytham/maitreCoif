'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const SCENES = ['Ouverture', 'Prestations', "L'univers", "L'équipe", 'Avis']

// Effets propres à l'accueil : léger parallaxe de l'enseigne et indicateur
// de scènes (01 à 05) à droite de l'écran.
export function HomeEffects() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const media = document.getElementById('heroMedia')
    let attente = false

    const onScroll = () => {
      if (attente || reduit || !media) return
      attente = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (y < 1400) media.style.transform = `translate3d(0, ${y * 0.16}px, 0)`
        attente = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number(e.target.getAttribute('data-scene')))
        }
      },
      { threshold: 0.4 },
    )
    document.querySelectorAll('[data-scene]').forEach((el) => io.observe(el))

    return () => {
      window.removeEventListener('scroll', onScroll)
      io.disconnect()
    }
  }, [])

  function aller(n: number) {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.querySelector(`[data-scene="${n}"]`)?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav className="scenes" aria-label="Scènes de la page d'accueil">
      {SCENES.map((label, i) => (
        <a
          key={label}
          href={`#scene-${i}`}
          className={cn(active === i && 'on')}
          aria-current={active === i ? 'true' : undefined}
          onClick={(e) => {
            e.preventDefault()
            aller(i)
          }}
        >
          <span>{label}</span>
          <i />
        </a>
      ))}
    </nav>
  )
}
