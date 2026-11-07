import { prisma } from '@/lib/prisma'

// Sert la photo d'un produit comme un vrai fichier image (elle est stockée en base sous forme de data URI).
// L'adresse porte un paramètre `v` qui change à chaque modification du produit : cache très long.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const produit = await prisma.produit.findUnique({ where: { id }, select: { image: true } })
  if (!produit?.image) return new Response('Image introuvable', { status: 404 })

  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(produit.image)
  if (!m) {
    return /^https?:\/\//i.test(produit.image) ? Response.redirect(produit.image, 302) : new Response('Format non pris en charge', { status: 415 })
  }

  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  })
}
