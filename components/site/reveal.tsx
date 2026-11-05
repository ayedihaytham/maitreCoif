import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Balise = 'div' | 'section' | 'article' | 'blockquote' | 'p' | 'h2'

// Bloc qui apparaît en fondu quand il entre à l'écran (cf. SiteEffects). Le
// délai (0 à 4) échelonne les blocs voisins de 90 ms chacun.
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: Balise
  delay?: number
  className?: string
  children: ReactNode
  id?: string
}) {
  return (
    <Tag className={cn('rv', className)} style={{ '--d': delay } as CSSProperties} {...rest}>
      {children}
    </Tag>
  )
}
