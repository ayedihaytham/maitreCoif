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
