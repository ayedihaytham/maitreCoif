import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { chargerPackAdmin, preparerPack } from '@/lib/boutique-admin'
import { prisma } from '@/lib/prisma'
import { packSchema } from '@/lib/validators'

type Contexte = { params: Promise<{ id: string }> }

async function estAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function PATCH(request: Request, { params }: Contexte) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params

  const corps = await request.json().catch(() => null)
  // Activer / désactiver : un simple interrupteur, sans renvoyer tout le pack.
  if (corps && typeof corps === 'object' && Object.keys(corps).length === 1 && typeof (corps as { actif?: unknown }).actif === 'boolean') {
    const { count } = await prisma.pack.updateMany({ where: { id }, data: { actif: (corps as { actif: boolean }).actif } })
    if (count === 0) return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 })
    return NextResponse.json(await chargerPackAdmin(id))
  }

  const parsed = packSchema.safeParse(corps)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existant = await prisma.pack.findUnique({ where: { id }, select: { id: true } })
  if (!existant) return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 })

  const pret = await preparerPack(parsed.data)
  if (!pret.ok) return NextResponse.json({ error: pret.erreur }, { status: 400 })

  await prisma.$transaction([
    prisma.packLigne.deleteMany({ where: { packId: id } }),
    prisma.pack.update({ where: { id }, data: { ...pret.donnees, lignes: { create: pret.lignes } } }),
  ])
  return NextResponse.json(await chargerPackAdmin(id))
}

export async function DELETE(_request: Request, { params }: Contexte) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params

  const { count } = await prisma.pack.deleteMany({ where: { id } })
  if (count === 0) return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 })
  // Les réservations passées gardent le contenu et le prix du pack (lignes figées).
  return NextResponse.json({ supprime: true })
}
