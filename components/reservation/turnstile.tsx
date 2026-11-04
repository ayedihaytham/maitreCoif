'use client'

import { useEffect, useRef } from 'react'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

function chargerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true })
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('Turnstile indisponible')))
    if (!existing) document.head.appendChild(script)
  })
}

/**
 * Widget anti-robot Cloudflare Turnstile. N'affiche rien (et ne charge aucun
 * script tiers) tant que NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas défini.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return
    let widgetId: string | undefined
    let annule = false

    chargerScript()
      .then(() => {
        if (annule || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => onToken(''))

    return () => {
      annule = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken])

  if (!SITE_KEY) return null
  return <div ref={containerRef} />
}
