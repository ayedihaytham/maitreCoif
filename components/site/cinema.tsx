'use client'

import { useEffect, useRef } from 'react'

import { borner } from '@/lib/utils'


const tous = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))

/**
 * Moteur de défilement : écrit des variables CSS que cinema-home.css utilise pour le
 * mouvement des sections (parallaxe, bande de cartes épinglée, mise au point).
 *   [data-track] -> --fp (0 à 1) et --fi (-1 à 1) ; [data-pin] -> --fp ; [data-depth] -> --ad
 */
export function Cinema() {
  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const plans = tous('[data-track]')
    const epingles = tous('[data-pin]')
    const profondeur = tous('[data-depth]')

    let raf = 0
    const miseAJour = () => {
      raf = 0
      if (reduit) return
      const vh = window.innerHeight
      const vw = window.innerWidth

      for (const el of plans) {
        const r = el.getBoundingClientRect()
        // data-track="out" : la progression est 0 en haut de page et 1 une fois la section sortie.
        const fp = el.dataset.track === 'out' ? -r.top / Math.max(1, r.height) : (vh - r.top) / (vh + r.height)
        el.style.setProperty('--fp', borner(fp).toFixed(4))
        el.style.setProperty('--fi', borner((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1).toFixed(4))
      }
      for (const el of epingles) {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--fp', borner(-r.top / Math.max(1, r.height - vh)).toFixed(4))
      }
      for (const el of profondeur) {
        const r = el.getBoundingClientRect()
        const ad = Math.min(1.5, Math.abs((r.left + r.width / 2 - vw / 2) / (vw / 2)))
        el.style.setProperty('--ad', ad.toFixed(3))
        el.classList.toggle('on', ad < 0.28) // carte « au point »
      }
    }
    const demander = () => {
      if (!raf) raf = requestAnimationFrame(miseAJour)
    }

    miseAJour()
    window.addEventListener('scroll', demander, { passive: true })
    window.addEventListener('resize', demander)
    const t = window.setTimeout(demander, 600) // mise en page finale (polices, images)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', demander)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
