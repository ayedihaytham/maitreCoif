'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

export const ANTI_ROBOT_ACTIF = Boolean(SITE_KEY)

/**
 * Anti-robot d'un formulaire : `widget` à placer dans le formulaire, `token` à envoyer avec la
 * requête, `manquant` tant que le visiteur n'a pas passé la vérification. Un jeton ne sert qu'une
 * fois : appeler `renouveler()` après chaque envoi.
 */
export function useAntiRobot() {
  const [token, setToken] = useState('')
  const [cle, setCle] = useState(0)
  const renouveler = useCallback(() => {
    setToken('')
    setCle((k) => k + 1)
  }, [])

  const widget = ANTI_ROBOT_ACTIF ? (
    <div>
      <p className="hint" style={{ margin: '4px 0 10px' }}>
        Vérification de sécurité : elle protège le salon contre les robots.
      </p>
      <TurnstileWidget key={cle} onToken={setToken} />
    </div>
  ) : null

  return { token, widget, manquant: ANTI_ROBOT_ACTIF && !token, renouveler }
}

export const MESSAGE_ANTI_ROBOT = 'Merci de valider la vérification anti-robot avant de continuer.'
