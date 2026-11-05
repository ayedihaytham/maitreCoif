'use client'

import { useEffect, useRef } from 'react'

import { borner } from '@/lib/utils'

const SCENES = ['Ouverture', 'Prestations', "L'univers", "L'équipe", 'Avis', 'Fin']

const tous = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))

/**
 * Moteur de mise en scène de l'accueil.
 *
 * Une seule boucle (requestAnimationFrame, déclenchée au défilement) écrit des
 * variables CSS ; tout le mouvement est ensuite décrit en CSS (cinema-home.css).
 *   [data-track] -> --fp (0 à 1 : entrée -> sortie du plan) et --fi (-1 à 1 : position par rapport au centre)
 *   [data-pin]   -> --fp (0 à 1 sur toute la durée où la section reste épinglée)
 *   [data-depth] -> --ad (distance horizontale au centre : sert à la profondeur de champ)
 * Elle pilote aussi (si `hud`) le lecteur (timecode, scène, barre de progression) et la
 * lumière qui suit la souris sur le premier plan.
 */
export function Cinema({ hud: avecLecteur = true }: { hud?: boolean }) {
  const hud = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const marques = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointeurFin = window.matchMedia('(pointer: fine)').matches

    const plans = tous('[data-track]')
    const epingles = tous('[data-pin]')
    const profondeur = tous('[data-depth]')
    const scenes = tous('[data-scene]')
    const hero = document.querySelector<HTMLElement>('.h-hero')

    let raf = 0
    let derniere = -1

    const miseAJour = () => {
      raf = 0
      const vh = window.innerHeight
      const vw = window.innerWidth

      if (!reduit) {
        for (const el of plans) {
          const r = el.getBoundingClientRect()
          // data-track="out" : plan de départ, la progression est 0 en haut de page et 1 une fois sorti.
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
          const d = (r.left + r.width / 2 - vw / 2) / (vw / 2)
          const ad = Math.min(1.5, Math.abs(d))
          el.style.setProperty('--ad', ad.toFixed(3))
          el.classList.toggle('on', ad < 0.28) // carte « au point »
        }
      }

      // Lecteur : la progression de la page est la tête de lecture du film.
      const course = document.documentElement.scrollHeight - vh
      const progression = course > 0 ? borner(window.scrollY / course) : 0
      if (fill.current) fill.current.style.width = `${(progression * 100).toFixed(2)}%`
      hud.current?.classList.toggle('off', progression > 0.985)

      // Scène courante : celle dont la plus grande partie est à l'écran.
      let meilleure = 0
      let surface = -1
      scenes.forEach((el, i) => {
        const r = el.getBoundingClientRect()
        const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0)
        if (visible > surface) {
          surface = visible
          meilleure = Number(el.getAttribute('data-scene') ?? i)
        }
      })
      if (meilleure !== derniere) {
        derniere = meilleure
        if (scene.current) scene.current.textContent = SCENES[meilleure] ?? ''
      }
    }

    const demander = () => {
      if (!raf) raf = requestAnimationFrame(miseAJour)
    }

    // Repères sur la barre : à l'endroit où chaque scène commence dans la page.
    const placerMarques = () => {
      const course = document.documentElement.scrollHeight - window.innerHeight
      marques.current.forEach((m) => m && (m.hidden = true)) // une scène absente (ex. aucun avis) n'a pas de repère
      scenes.forEach((el) => {
        const n = Number(el.getAttribute('data-scene'))
        const haut = el.getBoundingClientRect().top + window.scrollY
        const m = marques.current[n]
        if (m && course > 0) {
          m.hidden = false
          m.style.left = `${(borner(haut / course) * 100).toFixed(2)}%`
        }
      })
    }

    // Lumière qui suit la souris sur le premier plan (lissée), sur écran à souris.
    let cx = 0.68
    let cy = 0.46
    let cibleX = cx
    let cibleY = cy
    let boucle = 0
    const lisser = () => {
      cx += (cibleX - cx) * 0.08
      cy += (cibleY - cy) * 0.08
      hero?.style.setProperty('--mx', `${(cx * 100).toFixed(2)}%`)
      hero?.style.setProperty('--my', `${(cy * 100).toFixed(2)}%`)
      boucle = Math.abs(cibleX - cx) + Math.abs(cibleY - cy) > 0.002 ? requestAnimationFrame(lisser) : 0
    }
    const surSouris = (e: PointerEvent) => {
      if (!hero) return
      const r = hero.getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) return
      cibleX = borner((e.clientX - r.left) / r.width)
      cibleY = borner((e.clientY - r.top) / r.height)
      if (!boucle) boucle = requestAnimationFrame(lisser)
    }

    miseAJour()
    placerMarques()
    window.addEventListener('scroll', demander, { passive: true })
    const surRedim = () => {
      placerMarques()
      demander()
    }
    window.addEventListener('resize', surRedim)
    // Mise en page finale (polices, images) : on recalcule les repères.
    const t = window.setTimeout(surRedim, 600)
    if (pointeurFin && !reduit) window.addEventListener('pointermove', surSouris, { passive: true })

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', surRedim)
      window.removeEventListener('pointermove', surSouris)
      if (raf) cancelAnimationFrame(raf)
      if (boucle) cancelAnimationFrame(boucle)
    }
  }, [])

  function aller(n: number) {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.querySelector(`[data-scene="${n}"]`)?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <>
      {/* Grain de pellicule : un voile fixe, très léger */}
      <div className="h-grain" aria-hidden="true" />

      {avecLecteur && (
        <>
        {/* Lecteur : scène courante, barre de lecture cliquable, timecode */}
        <div className="h-hud" ref={hud} role="group" aria-label="Navigation dans la page : sections">
          <span className="h-hud-rec" aria-live="off">
            <span ref={scene}>Ouverture</span>
          </span>
          <div className="h-hud-track">
            <div className="h-hud-fill" ref={fill} />
            {SCENES.map((nom, n) => (
              <button
                key={nom}
                type="button"
                className="h-mark"
                aria-label={`Aller à la section : ${nom}`}
                ref={(el) => {
                  marques.current[n] = el
                }}
                onClick={() => aller(n)}
              />
            ))}
          </div>
          <span aria-hidden="true" />
        </div>
        </>
      )}
    </>
  )
}
