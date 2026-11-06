'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'

import { navigateurDePersonnel, suivre } from '@/lib/analytics'
import { nettoyerEvenement, nettoyerUrl } from '@/lib/analytics-vie-privee'

const CLE = process.env.NEXT_PUBLIC_POSTHOG_KEY

/**
 * Suivi d'audience du site public (PostHog), sans cookie ni bannière de consentement :
 *  - `cookieless_mode: 'always'` : aucun cookie ni stockage, l'identité est un hachage calculé côté PostHog ;
 *  - pas de capture automatique des clics (elle pourrait lire du texte personnel affiché à l'écran),
 *    pas d'enregistrement de session : seuls les événements listés dans le code sont envoyés ;
 *  - les adresses sont nettoyées avant l'envoi (code de suivi, jetons) ;
 *  - les envois passent par /ingest (le site lui-même), ce qui évite le blocage par les bloqueurs de publicité.
 * Monté uniquement sur le site public : ni le back-office ni l'espace équipe ne sont suivis.
 */
export function PostHogProvider() {
  const pathname = usePathname()

  useEffect(() => {
    if (!CLE || posthog.__loaded || navigateurDePersonnel()) return
    posthog.init(CLE, {
      api_host: '/ingest',
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://eu.posthog.com',
      cookieless_mode: 'always',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: false, // pages vues envoyées à la main (ci-dessous) : navigation interne de Next.js
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      respect_dnt: true,
      // Mode diagnostic (NEXT_PUBLIC_POSTHOG_DEBUG=1) : journal détaillé dans la console, et navigateurs automatisés acceptés.
      debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === '1',
      opt_out_useragent_filter: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === '1',
      before_send: (cr) => nettoyerEvenement(cr),
    })
  }, [])

  // Une page vue à chaque changement de page (Next.js ne recharge pas le document).
  useEffect(() => {
    if (!CLE || !posthog.__loaded) return
    posthog.capture('$pageview', { $current_url: nettoyerUrl(window.location.href) })
  }, [pathname])

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
