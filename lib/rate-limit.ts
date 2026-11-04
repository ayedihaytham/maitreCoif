// Rate limiting partagé via la base de données : sur Vercel (serverless),
// chaque instance a sa propre mémoire, un compteur en mémoire ne protégerait
// donc rien. Chaque tentative est enregistrée dans RateLimitHit et comptée
// sur la fenêtre glissante demandée.
import { prisma } from '@/lib/prisma'

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowMs)
    const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gt: since } } })
    if (count >= limit) return false

    await prisma.rateLimitHit.create({ data: { key } })

    // Nettoyage opportuniste des tentatives de plus de 24 h.
    if (Math.random() < 0.02) {
      await prisma.rateLimitHit
        .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        .catch(() => {})
    }
    return true
  } catch (error) {
    // Fail-open : une panne du compteur ne doit pas rendre le site inutilisable.
    console.error('Rate limit indisponible :', error)
    return true
  }
}

// Sur Vercel, x-vercel-forwarded-for est positionné par la plateforme et ne
// peut pas être falsifié par le client, contrairement au début de
// x-forwarded-for.
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
