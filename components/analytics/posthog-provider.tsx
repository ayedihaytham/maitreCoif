'use client'

import { useEffect } from 'react'

import { suivre } from '@/lib/analytics'

const CLE = process.env.NEXT_PUBLIC_POSTHOG_KEY

/** Écoute les clics explicitement marqués sur le site public. PostHog est initialisé dans instrumentation-client.ts. */
export function PostHogProvider() {
  // Clics sur les éléments marqués data-ph="nom" : un événement « clic » avec la cible, rien d'autre.
  useEffect(() => {
    if (!CLE) return
    const surClic = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-ph]')
      const cible = el?.getAttribute('data-ph')
      if (cible) suivre('clic', { cible })
    }
    document.addEventListener('click', surClic, { capture: true })
    return () => document.removeEventListener('click', surClic, { capture: true })
  }, [])

  return null
}
