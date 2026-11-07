import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { changerStatutCommande } from '@/lib/boutique'
import { impactSuppressionProduit, versProduitAdmin } from '@/lib/boutique-admin'
import { notifierAnnulationCommande } from '@/lib/boutique-emails'
import { prisma } from '@/lib/prisma'
import { produitSchema } from '@/lib/validators'

type Contexte = { params: Promise<{ id: string }> }

async function estAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function PATCH(request: Request, { params }: Contexte) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params

  const parsed = produitSchema.partial().safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existant = await prisma.produit.findUnique({ where: { id }, select: { id: true } })
  if (!existant) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  const { nom, description, prix, categorie, stock, actif, image } = parsed.data
  const produit = await prisma.produit.update({
    where: { id },
    data: {
      ...(nom !== undefined ? { nom } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(prix !== undefined ? { prix } : {}),
      ...(categorie !== undefined ? { categorie: categorie || null } : {}),
      ...(stock !== undefined ? { stock } : {}),
      ...(actif !== undefined ? { actif } : {}),
      // absent : photo conservée ; null ou '' : photo retirée
      ...(image !== undefined ? { image: image || null } : {}),
    },
  })
  return NextResponse.json(versProduitAdmin(produit))
}

export async function DELETE(request: Request, { params }: Contexte) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params
  const cascade = new URL(request.url).searchParams.get('cascade') === '1'

  const produit = await prisma.produit.findUnique({ where: { id }, select: { nom: true } })
  if (!produit) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  // Sans « cascade », on ne supprime que ce qui n'a aucune conséquence ailleurs ; sinon on montre ce qui changerait.
  const impact = await impactSuppressionProduit(id)
  if (!cascade && (impact.packs.length > 0 || impact.commandes.length > 0)) {
    return NextResponse.json(
      {
        error: `« ${produit.nom} » est utilisé : ${[
          impact.packs.length > 0 ? `${impact.packs.length} pack${impact.packs.length > 1 ? 's' : ''}` : '',
          impact.commandes.length > 0 ? `${impact.commandes.length} réservation${impact.commandes.length > 1 ? 's' : ''} en cours` : '',
        ]
          .filter(Boolean)
          .join(' et ')}.`,
        impact: { packs: impact.packs.map((p) => p.nom), commandes: impact.commandes.length },
      },
      { status: 409 },
    )
  }

  // Les réservations en cours qui le contiennent sont annulées (stock rendu, rendez-vous lié annulé) ...
  const annulees = []
  for (const c of impact.commandes) {
    const r = await changerStatutCommande(c.id, 'ANNULEE')
    if (r.ok) annulees.push(r.commande)
  }

  // ... il est retiré des packs (un pack qui se retrouve vide est désactivé) puis supprimé.
  const idsPacks = impact.packs.map((p) => p.id)
  await prisma.$transaction([
    prisma.packLigne.deleteMany({ where: { produitId: id } }),
    prisma.pack.updateMany({ where: { id: { in: idsPacks }, lignes: { none: {} } }, data: { actif: false } }),
    // L'historique garde le nom et le prix du produit (lignes figées).
    prisma.produit.delete({ where: { id } }),
  ])

  // Les clients dont la réservation a été annulée en sont informés par email.
  for (const c of annulees) await notifierAnnulationCommande(c, true)

  return NextResponse.json({
    supprime: true,
    packsModifies: impact.packs.length,
    commandesAnnulees: annulees.length,
    clientsPrevenus: annulees.length,
  })
}
