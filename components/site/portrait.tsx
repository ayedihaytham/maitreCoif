import type { CSSProperties } from 'react'
import Image from 'next/image'

import type { Portrait } from '@/lib/portraits'

// Portrait rond d'un membre de l'équipe : découpe de la planche, vraie photo
// ou monogramme (cf. lib/portraits.ts). `taille` en px, 220 par défaut (CSS).
export function PortraitRond({ portrait, nom, taille }: { portrait: Portrait; nom: string; taille?: number }) {
  const style = taille ? ({ '--d': `${taille}px` } as CSSProperties) : undefined

  if (portrait.type === 'planche') {
    return <div className={`pt ${portrait.position}`} role="img" aria-label={`Portrait de ${nom}`} style={style} />
  }

  if (portrait.type === 'photo') {
    return (
      <div className="pt photo" style={style}>
        <Image src={portrait.src} alt={`Portrait de ${nom}`} fill sizes={`${taille ?? 220}px`} />
      </div>
    )
  }

  return (
    <div className="pt no-ph" role="img" aria-label={`Portrait à venir pour ${nom}`} style={style}>
      {portrait.initiales}
    </div>
  )
}
