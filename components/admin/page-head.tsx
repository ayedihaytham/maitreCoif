import type { ReactNode } from 'react'

// En-tête commun des pages de la régie : étiquette de section, titre en serif,
// description facultative et zone d'actions à droite.
export function AdminPageHead({
  section,
  titre,
  description,
  children,
}: {
  section: string
  titre: ReactNode
  description?: string
  children?: ReactNode
}) {
  return (
    <header className="ad-head">
      <div>
        <div className="lbl">Espace salon · {section}</div>
        <h1>{titre}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="ad-actions">{children}</div>}
    </header>
  )
}
