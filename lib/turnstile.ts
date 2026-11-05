import { NextResponse } from 'next/server'

// Vérification côté serveur du jeton Cloudflare Turnstile. Sans
// TURNSTILE_SECRET_KEY, la vérification est désactivée (honeypot + rate
// limiting restent actifs).
export async function verifierTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip !== 'unknown') body.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error('Vérification Turnstile impossible :', error)
    return false
  }
}

/**
 * Garde pour les routes publiques sensibles : renvoie la réponse d'erreur (400) si le jeton
 * anti-robot du corps de la requête (`turnstileToken`) est absent ou refusé, sinon null.
 */
export async function refuserSiRobot(body: unknown, ip: string): Promise<NextResponse | null> {
  const jeton = typeof body === 'object' && body !== null ? (body as { turnstileToken?: unknown }).turnstileToken : undefined
  if (await verifierTurnstile(typeof jeton === 'string' ? jeton : undefined, ip)) return null
  return NextResponse.json({ error: 'Vérification anti-robot échouée, merci de réessayer.' }, { status: 400 })
}
