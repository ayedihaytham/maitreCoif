'use client'

import { useEffect, useRef } from 'react'

import { borner } from '@/lib/utils'

const SCENES = ['Ouverture', 'Prestations', "L'univers", "L'équipe", 'Avis', 'Fin']

const tous = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))

interface Carte {
  el: HTMLElement
  /** Position du centre de la carte dans la pellicule (px), mesurée hors défilement. */
  centre: number
  flare: HTMLElement | null
  ad: number
  point: boolean
}
interface Pellicule {
  reel: HTMLElement
  strip: HTMLElement
  largeur: number
  /** Flou et assombrissement maximaux de la profondeur de champ (variables CSS --dof-*). */
  flou: number
  voile: number
  cartes: Carte[]
}

/**
 * Moteur de mise en scène de l'accueil.
 *
 * Une seule boucle (requestAnimationFrame, déclenchée au défilement) écrit des variables CSS ;
 * le mouvement est décrit en CSS (cinema-home.css).
 *   [data-track] -> --fp (0 à 1 : entrée -> sortie du plan) et --fi (-1 à 1 : position par rapport au centre)
 *   [data-pin]   -> la pellicule épinglée : translation de la bande + profondeur de champ de chaque carte
 * Elle pilote aussi le lecteur (scène, barre de progression) et la lumière qui suit la souris.
 *
 * Performances : toutes les lectures de géométrie sont groupées avant toutes les écritures (un seul
 * calcul de mise en page par image) ; seules les sections visibles sont traitées ; la bande est déplacée
 * directement (transform, sans variable CSS héritée par tous ses descendants) ; la position des cartes est
 * calculée à partir de mesures prises hors défilement, donc sans relire la page à chaque image.
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
    const scenes = tous('[data-scene]')
    const hero = document.querySelector<HTMLElement>('.h-hero')

    let raf = 0
    let derniere = -1
    let derniereProgression = -1

    function demander() {
      if (!raf) raf = requestAnimationFrame(miseAJour)
    }

    // Sections à l'écran : les autres ne coûtent rien pendant le défilement.
    const visibles = new Set<HTMLElement>()
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (e.isIntersecting) visibles.add(e.target as HTMLElement)
          else visibles.delete(e.target as HTMLElement)
        }
        demander()
      },
      { rootMargin: '120px 0px' },
    )
    for (const el of [...plans, ...epingles]) observateur.observe(el)

    // Géométrie des pellicules, mesurée une fois (et à chaque redimensionnement), pas à chaque image.
    let pellicules: Pellicule[] = []
    const mesurer = () => {
      pellicules = epingles.flatMap((reel) => {
        const strip = reel.querySelector<HTMLElement>('.h-strip')
        if (!strip) return []
        const sr = strip.getBoundingClientRect()
        const cartes = Array.from(reel.querySelectorAll<HTMLElement>('[data-depth]')).map((el) => {
          const cr = el.getBoundingClientRect()
          return { el, centre: cr.left + cr.width / 2 - sr.left, flare: el.querySelector<HTMLElement>('.flare'), ad: -1, point: false }
        })
        const css = getComputedStyle(reel)
        const flou = parseFloat(css.getPropertyValue('--dof-blur')) || 6
        const voile = parseFloat(css.getPropertyValue('--dof-dim')) || 0.42
        return [{ reel, strip, largeur: strip.offsetWidth, flou, voile, cartes }]
      })
    }

    function miseAJour() {
      raf = 0
      const vh = window.innerHeight
      const vw = window.innerWidth

      // ───── 1. LECTURES (toutes ensemble) ─────
      const lus: [HTMLElement, DOMRect][] = []
      if (!reduit) for (const el of visibles) lus.push([el, el.getBoundingClientRect()])
      const course = document.documentElement.scrollHeight - vh
      const rectScenes = avecLecteur ? scenes.map((el) => el.getBoundingClientRect()) : []

      // ───── 2. ÉCRITURES ─────
      for (const [el, r] of lus) {
        if (el.hasAttribute('data-pin')) {
          const fp = borner(-r.top / Math.max(1, r.height - vh))
          const p = pellicules.find((x) => x.reel === el)
          if (!p) continue
          const tx = -Math.max(0, p.largeur - vw) * fp
          p.strip.style.transform = `translate3d(${tx.toFixed(2)}px,0,0)`
          for (const c of p.cartes) {
            const ad = Math.min(1.5, Math.abs((tx + c.centre - vw / 2) / (vw / 2)))
            if (Math.abs(ad - c.ad) >= 0.002) {
              c.ad = ad
              // Profondeur de champ écrite directement sur la carte (et sa lueur) : aucune variable CSS à
              // propager, donc aucun recalcul de style sur le contenu de la carte à chaque image.
              c.el.style.filter = `blur(${(ad * ad * p.flou).toFixed(2)}px) brightness(${(1.06 - ad * p.voile).toFixed(3)})`
              c.el.style.transform = `scale(${(1.05 - ad * 0.11).toFixed(4)})`
              if (c.flare) c.flare.style.transform = `translateX(${(ad * 90).toFixed(2)}%)`
            }
            const point = ad < 0.28 // carte « au point »
            if (point !== c.point) {
              c.point = point
              c.el.classList.toggle('on', point)
            }
          }
        } else {
          // data-track="out" : la progression est 0 en haut de page et 1 une fois la section sortie.
          const fp = el.dataset.track === 'out' ? -r.top / Math.max(1, r.height) : (vh - r.top) / (vh + r.height)
          el.style.setProperty('--fp', borner(fp).toFixed(4))
          el.style.setProperty('--fi', borner((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1).toFixed(4))
        }
      }

      if (!avecLecteur) return

      // Lecteur : la progression de la page est la tête de lecture.
      const progression = course > 0 ? borner(window.scrollY / course) : 0
      if (Math.abs(progression - derniereProgression) > 0.0005) {
        derniereProgression = progression
        if (fill.current) fill.current.style.transform = `scaleX(${progression.toFixed(4)})`
        hud.current?.classList.toggle('off', progression > 0.985)
      }

      // Scène courante : celle dont la plus grande partie est à l'écran.
      let meilleure = 0
      let surface = -1
      scenes.forEach((el, i) => {
        const r = rectScenes[i]
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
      if (!hero || !visibles.has(hero)) return // la lumière ne suit la souris que tant que le plan d'ouverture est à l'écran
      const r = hero.getBoundingClientRect()
      cibleX = borner((e.clientX - r.left) / r.width)
      cibleY = borner((e.clientY - r.top) / r.height)
      if (!boucle) boucle = requestAnimationFrame(lisser)
    }

    mesurer()
    placerMarques()
    demander()
    window.addEventListener('scroll', demander, { passive: true })
    const surRedim = () => {
      mesurer()
      placerMarques()
      demander()
    }
    window.addEventListener('resize', surRedim)
    // Mise en page finale (polices, images) : on remesure.
    const t = window.setTimeout(surRedim, 600)
    if (pointeurFin && !reduit) window.addEventListener('pointermove', surSouris, { passive: true })

    return () => {
      window.clearTimeout(t)
      observateur.disconnect()
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', surRedim)
      window.removeEventListener('pointermove', surSouris)
      if (raf) cancelAnimationFrame(raf)
      if (boucle) cancelAnimationFrame(boucle)
    }
  }, [avecLecteur])

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
          {/* Lecteur : scène courante et barre de lecture cliquable */}
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
