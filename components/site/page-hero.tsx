import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils'

/**
 * Plan d'ouverture des pages intérieures : image plein cadre étalonnée (facultative),
 * lumière qui dérive, cadre de viseur, titre révélé ligne par ligne. Le parallaxe est
 * piloté par <Cinema hud={false} /> (data-track="out").
 */
export function PageHero({
  etiquette,
  lignes,
  texte,
  image,
  courte,
}: {
  etiquette: string
  /** Lignes du titre ; `or: true` met la ligne en italique doré. */
  lignes: { t: string; or?: boolean }[]
  texte?: ReactNode
  image?: string
  courte?: boolean
}) {
  return (
    <section className={cn('ph-hero', courte && 'short')} data-track="out">
      {image && (
        <div className="ph-media" aria-hidden="true">
          <Image src={image} alt="" fill priority sizes="100vw" />
        </div>
      )}
      <div className="ph-light" aria-hidden="true" />
      <div className="ph-shade" aria-hidden="true" />
      <span className="ph-vf tl" aria-hidden="true" />
      <span className="ph-vf tr" aria-hidden="true" />
      <span className="ph-vf bl" aria-hidden="true" />
      <span className="ph-vf br" aria-hidden="true" />

      <div className="wrap ph-copy">
        <div className="lbl">{etiquette}</div>
        <h1 className="h-title ph-title">
          {lignes.map((l, i) => (
            <span key={l.t} className={cn('ln', l.or && 'gold')} style={{ '--i': i } as CSSProperties}>
              <span>{l.t}</span>
            </span>
          ))}
        </h1>
        {texte && <p className="h-sub ph-text">{texte}</p>}
      </div>
    </section>
  )
}
