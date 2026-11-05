'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface AvisAffiche {
  id: string
  note: number
  texte: string
  client: string
  meta: string
}

// Citation en grand ; plusieurs avis => points pour passer de l'un à l'autre.
export function ReviewCarousel({ avis }: { avis: AvisAffiche[] }) {
  const [index, setIndex] = useState(0)
  const a = avis[index] ?? avis[0]
  if (!a) return null

  return (
    <div aria-live="polite">
      <blockquote style={{ margin: 0 }}>
        <p className="quote">« {a.texte} »</p>
        <div className="stars" role="img" aria-label={`${a.note} étoiles sur 5`}>
          {Array.from({ length: a.note }).map((_, i) => (
            <Star key={i} className="size-5" fill="currentColor" aria-hidden="true" />
          ))}
        </div>
        <footer className="who">
          <div className="lbl" style={{ letterSpacing: '.24em' }}>
            {a.client}
          </div>
          {a.meta && <small>{a.meta}</small>}
        </footer>
      </blockquote>

      {avis.length > 1 && (
        <div className="dots" role="group" aria-label="Choisir un avis">
          {avis.map((x, i) => (
            <button
              key={x.id}
              type="button"
              className={cn('dot', i === index && 'on')}
              aria-label={`Avis de ${x.client}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
