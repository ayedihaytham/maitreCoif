import { prisma } from '@/lib/prisma'

// Sert une photo de la galerie comme un vrai fichier image. Les photos sont stockées en base
// (data URI) : les mettre telles quelles dans les pages les alourdirait de plusieurs Mo. Une photo
// ne change jamais (l'identifiant change quand on en ajoute une autre) : cache très long.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const photo = await prisma.photoSalon.findUnique({ where: { id }, select: { url: true } })
  if (!photo) return new Response('Photo introuvable', { status: 404 })

  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(photo.url)
  if (!m) {
    // Photo déjà hébergée ailleurs : simple redirection.
    return /^https?:\/\//i.test(photo.url) ? Response.redirect(photo.url, 302) : new Response('Format non pris en charge', { status: 415 })
  }

  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  })
}
