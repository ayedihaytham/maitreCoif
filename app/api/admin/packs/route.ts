import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { chargerPackAdmin, listerPacksAdmin, preparerPack } from '@/lib/boutique-admin'
import { prisma } from '@/lib/prisma'
import { packSchema } from '@/lib/validators'

async function estAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  return NextResponse.json(await listerPacksAdmin())
}

export async function POST(request: Request) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const parsed = packSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const pret = await preparerPack(parsed.data)
  if (!pret.ok) return NextResponse.json({ error: pret.erreur }, { status: 400 })

  const pack = await prisma.pack.create({ data: { ...pret.donnees, lignes: { create: pret.lignes } } })
  return NextResponse.json(await chargerPackAdmin(pack.id), { status: 201 })
}
