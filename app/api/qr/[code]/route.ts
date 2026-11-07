import { CODE_COMMANDE_VALIDE, CODE_SUIVI_VALIDE } from '@/lib/liens'
import { qrSuiviPng } from '@/lib/qr'

// Image du QR code d'un rendez-vous ou d'une réservation de produits (écran de confirmation et emails).
// Il n'encode que l'adresse publique de la page avec ce code : aucune donnée n'est lue en base, et un code de suivi n'est de
// toute façon pas un secret plus fort que le lien qu'il contient.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalise = decodeURIComponent(code).trim().toUpperCase()
  if (!CODE_SUIVI_VALIDE.test(normalise) && !CODE_COMMANDE_VALIDE.test(normalise)) return new Response('Code invalide', { status: 400 })

  const png = await qrSuiviPng(normalise)
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
