import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { changerStatutCommande } from '@/lib/boutique'
import { versCommandeAdmin } from '@/lib/boutique-admin'
import { notifierAnnulationCommande, notifierCommandePrete } from '@/lib/boutique-emails'
import { statutCommandeSchema } from '@/lib/validators'

// Les réservations de produits (avec leurs montants) sont réservées au gérant.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  const { id } = await params

  const parsed = statutCommandeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const resultat = await changerStatutCommande(id, parsed.data.statut)
  if (!resultat.ok) {
    return resultat.code === 'introuvable'
      ? NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
      : NextResponse.json({ error: 'Cette réservation ne peut plus passer à ce statut (elle a peut-être déjà été modifiée).', statut: resultat.statut }, { status: 409 })
  }

  const { commande } = resultat
  // Le client est prévenu par email : « prête à retirer » ou « annulée ».
  if (parsed.data.statut === 'PRETE') await notifierCommandePrete(commande)
  else if (parsed.data.statut === 'ANNULEE') await notifierAnnulationCommande(commande, true)

  return NextResponse.json({ commande: versCommandeAdmin(commande), clientPrevenu: parsed.data.statut !== 'RETIREE' })
}
