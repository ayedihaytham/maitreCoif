import { notFound } from 'next/navigation'

import { PreviewClient } from './preview-client'

// Banc d'essai du back-office avec de fausses données, pour l'audit d'accessibilité et de
// contraste (scripts/a11y-audit.mjs) sans session Clerk. Désactivé partout sauf si le
// serveur est lancé avec DEV_PREVIEW=1 : en production la page n'existe pas (404).
export const dynamic = 'force-dynamic'

export default function DevPreviewPage() {
  if (process.env.DEV_PREVIEW !== '1' || process.env.NODE_ENV === 'production' && process.env.VERCEL) notFound()
  return <PreviewClient />
}
