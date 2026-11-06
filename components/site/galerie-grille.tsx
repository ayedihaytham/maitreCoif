'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { suivre } from '@/lib/analytics'

export interface PhotoGalerie {
  id: string
  legende: string | null
}

const src = (id: string) => `/api/galerie/${id}/image`

/** Grille de photos du salon ; un clic ouvre la photo en grand (flèches du clavier pour naviguer). */
export function GalerieGrille({ photos }: { photos: PhotoGalerie[] }) {
  const [ouverte, setOuverte] = useState<number | null>(null)
  const dialogue = useRef<HTMLDialogElement>(null)
  const declencheur = useRef<HTMLElement | null>(null)

  const fermer = useCallback(() => dialogue.current?.close(), [])
  const aller = useCallback(
    (pas: number) => setOuverte((i) => (i === null ? i : (i + pas + photos.length) % photos.length)),
    [photos.length],
  )

  useEffect(() => {
    const d = dialogue.current
    if (!d) return
    if (ouverte !== null && !d.open) d.showModal()
  }, [ouverte])

  useEffect(() => {
    if (ouverte === null) return
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') aller(1)
      if (e.key === 'ArrowLeft') aller(-1)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [ouverte, aller])

  const photo = ouverte !== null ? photos[ouverte] : null

  return (
    <>
      <ul className="gal-grid">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className="gal-item"
              aria-label={p.legende ? `Agrandir : ${p.legende}` : `Agrandir la photo ${i + 1}`}
              onClick={(e) => {
                declencheur.current = e.currentTarget
                setOuverte(i)
                suivre('galerie_photo_ouverte')
              }}
            >
              <Image src={src(p.id)} alt={p.legende || `Photo ${i + 1} du salon Maitre Coif`} fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" />
              {p.legende && <span className="gal-cap">{p.legende}</span>}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogue}
        className="gal-dialog"
        aria-label="Photo agrandie"
        onClose={() => {
          setOuverte(null)
          declencheur.current?.focus()
        }}
        onClick={(e) => e.target === e.currentTarget && fermer()}
      >
        {photo && (
          <figure className="gal-fig">
            {/* eslint-disable-next-line @next/next/no-img-element -- photo agrandie : taille d'origine, une seule à la fois */}
            <img src={src(photo.id)} alt={photo.legende || 'Photo du salon Maitre Coif'} />
            {photo.legende && <figcaption>{photo.legende}</figcaption>}
          </figure>
        )}
        <button type="button" className="gal-btn gal-close" onClick={fermer} aria-label="Fermer">
          <X aria-hidden="true" />
        </button>
        {photos.length > 1 && (
          <>
            <button type="button" className="gal-btn gal-prev" onClick={() => aller(-1)} aria-label="Photo précédente">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="gal-btn gal-next" onClick={() => aller(1)} aria-label="Photo suivante">
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
      </dialog>
    </>
  )
}
