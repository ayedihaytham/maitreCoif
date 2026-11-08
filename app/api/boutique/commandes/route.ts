import { NextResponse } from 'next/server'

import { notifierConfirmation } from '@/lib/booking'
import { creerCommande, lireDetail } from '@/lib/boutique'
import { notifierNouvelleCommande } from '@/lib/boutique-emails'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { verifierTurnstile } from '@/lib/turnstile'
import { commandeSchema } from '@/lib/validators'

// Réservation de produits et de packs. Pas de compte, pas de paiement en ligne : le client règle au salon.
export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!(await checkRateLimit(`commande:${ip}`, 6, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const parsed = commandeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (parsed.data.website) {
    // Honeypot rempli : soumission automatisée, on répond succès factice sans rien créer.
    return NextResponse.json({ code: 'PR-0000000' }, { status: 201 })
  }
  if (!(await verifierTurnstile(parsed.data.turnstileToken, ip))) {
    return NextResponse.json({ error: 'Vérification anti-robot échouée, merci de réessayer.' }, { status: 400 })
  }

  const { clientNom, clientTelephone, clientEmail, retrait, jourSouhaite, notes, lignes } = parsed.data
  const resultat = await creerCommande({ clientNom, clientTelephone, clientEmail, retrait, jourSouhaite: jourSouhaite || null, notes: notes || null, lignes })
  if (!resultat.ok) {
    return NextResponse.json({ error: resultat.problemes[0], problemes: resultat.problemes }, { status: 409 })
  }

  // Confirmation au client (avec QR code) et alerte au salon ; un échec d'envoi ne casse jamais la réservation.
  await notifierNouvelleCommande(resultat.commande)
  // Pack avec prestation : le rendez-vous est confirmé comme n'importe quel autre (email avec QR de suivi, WhatsApp).
  if (resultat.rendezVous && resultat.commande.rendezVous) {
    const rdv = resultat.commande.rendezVous
    await notifierConfirmation(resultat.rendezVous, {
      coiffeurNom: `${rdv.coiffeur.prenom} ${rdv.coiffeur.nom}`,
      serviceNom: resultat.commande.lignes.flatMap((l) => (l.type === 'PACK' ? lireDetail(l.detail).filter((e) => e.type === 'service').map((e) => e.nom) : [])).join(' + ') || 'Prestation du pack',
    })
  }

  return NextResponse.json({ code: resultat.commande.code }, { status: 201 })
}
