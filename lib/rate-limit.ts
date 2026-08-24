// Rate limiting basique en mémoire pour protéger les routes publiques
// (réservation, suivi, avis) contre les soumissions automatisées, en
// complément du champ honeypot. Suffisant pour une instance unique ; à
// remplacer par un store partagé (Redis) si l'app est un jour multi-instance.

const hits = new Map<string, number[]>()

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (timestamps.length >= limit) {
    hits.set(key, timestamps)
    return false
  }
  timestamps.push(now)
  hits.set(key, timestamps)
  return true
}

export function clientIpFrom(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? 'unknown'
}
